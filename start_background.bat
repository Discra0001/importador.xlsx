@echo off
echo Iniciando aplicacao em background...
node app.js > log.txt 2>&1 &
echo Aplicacao iniciada em background. Verifique o arquivo log.txt para os logs.