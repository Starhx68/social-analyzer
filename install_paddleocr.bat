@echo off
echo Creating Conda environment 'guobu'...
call conda create -n guobu python=3.8 -y

echo Activating environment 'guobu'...
call conda activate guobu

echo Installing PaddlePaddle (CPU version)...
call python -m pip install paddlepaddle -i https://mirror.baidu.com/pypi/simple

echo Installing PaddleOCR...
call python -m pip install "paddleocr>=2.0.1" -i https://mirror.baidu.com/pypi/simple

echo Installing dependencies...
call pip install flask pillow numpy

echo Done!
echo To run the OCR server, execute: run_paddleocr.bat
pause
