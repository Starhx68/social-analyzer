const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');

async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const result = await db.query(
      `SELECT 
         u.id, 
         u.username, 
         u.role, 
         u.organization_id, 
         u.status,
         o.code AS organization_code
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    const user = result.rows[0];
    const orgCode = user.organization_code ? String(user.organization_code).toLowerCase() : null;
    const privilegedOrgs = Array.isArray(config.privilegedOrgs) ? config.privilegedOrgs : [];
    const isPrivilegedOrganization = !!orgCode && privilegedOrgs.includes(orgCode);
    user.is_privileged_organization = isPrivilegedOrganization;
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已被禁用' });
    }
    
    req.user = user;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '无效或过期的令牌' });
    }
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

function requireAuditor(req, res, next) {
  return requireRole('admin', 'auditor')(req, res, next);
}

function requirePrivilegedOrg(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }
  const orgCode = req.user.organization_code ? String(req.user.organization_code).toLowerCase() : null;
  const privilegedOrgs = Array.isArray(config.privilegedOrgs) ? config.privilegedOrgs : [];
  if (!orgCode || !privilegedOrgs.includes(orgCode)) {
    return res.status(403).json({ error: '该组织无审核/上报权限' });
  }
  next();
}

module.exports = {
  auth,
  requireRole,
  requireAdmin,
  requireAuditor,
  requirePrivilegedOrg
};
