@echo off
echo Activating environment 'guobu'...
call conda activate guobu

echo Starting PaddleOCR server...
cd docker/paddleocr
python server.py
pause
