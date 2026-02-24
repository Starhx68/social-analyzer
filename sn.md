我需要新增一个web菜单界面，pc端和移动端都需要，在界面上有一个sn的输入框，并提供ocr查询功能，可拍照录入sn码，sn输入之后，调用外部接口（同：发票和查询）查询输入的sn码是否可以销售，

如查询的sn返回成功，则显示可销售，在下方显示“锁定SN”按钮，如人工点击按钮后调用sn锁定功能进行锁定，如锁定成功则提示锁定成功，如不成功，则显示锁定不成功，并返回详细信息。成功锁定后此照片和sn号直接保存到上传资料的sn信息中。

如查询的sn返回不成功，则显示详细的错误信息，“锁定SN”按钮为灰色，不可操作。

以上功能为新增，不得影响其他功能。


<!-- SN锁定示例 -->

<?xml version="1.0" encoding="GB18030"?>

<Program>

    `<appid>`80`</appid>`

    `<FunctionID>`HG960828`</FunctionID>`

    `<Action>`query`</Action>`

    `<parameters>`

    `<sn>`258024000953101103230100244`</sn>`

    <homa_order_no>25110237585055</homa_order_no>

    `</parameters>`

    `<addition-xml>`

    `<row1>`

    `<add1>`APPUser`</add1>`

    `<add2>`107898`</add2>`

    `<add3>`10.10.1.999`</add3>`

    `<add4>`1A682300CCE8D608ABProd`</add4>`

    `</row1>`

    `</addition-xml>`

</Program>

<!-- 查询SN状态结果返回，success=0是失败, 1是成功, message是具体原因-->

---

<Program>

    `<ErrorNo>`1`</ErrorNo>`

    `<UIMessage>`ok`</UIMessage>`

    `<ErrorMessage></ErrorMessage>`

    `<ErrorType>`0`</ErrorType>`

    `<parameters>`

    `<success>`0`</success>`

    <log_session_id>APP0120260212093218134_1</log_session_id>

    `<message>`当前厂商社会信用代码[9144030027939873X711]未配置`</message>`

    `<respCode>`030001`</respCode>`

    `</parameters>`

</Program>

<Program>

    `<ErrorNo>`1`</ErrorNo>`

    `<UIMessage>`ok`</UIMessage>`

    `<ErrorMessage></ErrorMessage>`

    `<ErrorType>`0`</ErrorType>`

    `<parameters>`

    `<success>`1`</success>`

    `<sellState>`U0022`</sellState>`

    <log_session_id>APP0120260212093306217_1</log_session_id>

    `<message>`国家平台响应码&lt;T0022&gt;响应描述&lt;本设备符合补贴条件&gt;`</message>`

    `<respCode>`000000`</respCode>`

    `<sellStateDesc>`可售`</sellStateDesc>`

    `</parameters>`

</Program>

<Program>

    `<ErrorNo>`1`</ErrorNo>`

    `<UIMessage>`ok`</UIMessage>`

    `<ErrorMessage></ErrorMessage>`

    `<ErrorType>`0`</ErrorType>`

    `<parameters>`

    `<success>`0`</success>`

    `<sellState>`U0024`</sellState>`

    <log_session_id>APP0120260212092948097_1</log_session_id>

    `<message>`国家平台响应码&lt;T0024&gt;响应描述&lt;未查到相关信息&gt;`</message>`

    `<respCode>`000000`</respCode>`

    `<sellStateDesc>`未查到相关信息`</sellStateDesc>`

    `</parameters>`

</Program>

---

<!-- 锁定SN示例 -->

<?xml version="1.0" encoding="GB18030"?>

<Program>

    `<appid>`80`</appid>`

    `<FunctionID>`HG960828`</FunctionID>`

    `<Action>`lock`</Action>`

    `<parameters>`

    `<sn>`258024000953101103230100244`</sn>`

    <homa_order_no>25110237585055</homa_order_no>

    `</parameters>`

    `<addition-xml>`

    `<row1>`

    `<add1>`APPUser`</add1>`

    `<add2>`107898`</add2>`

    `<add3>`10.10.1.999`</add3>`

    `<add4>`1A682300CCE8D608ABProd`</add4>`

    `</row1>`

    `</addition-xml>`

</Program>
