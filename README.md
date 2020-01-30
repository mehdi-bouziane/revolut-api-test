# revolut-api-test

Description
=====

A Revolut API test

Install
====

The server is running by default on localhost:3000, run the configuration of the revolut api

- generate your public and private key with the commands :

```console
openssl genrsa -out privatekey.pem 1024
openssl req -new -x509 -key privatekey.pem -out publickey.cer -days 1825
```

- Clone the project
```console
git clone https://github.com/mehdi-bouziane/revolut-api-test.git
```

- copy and rename the .env.default file to .env and add the parameters

exemple :
```
HOSTNAME=127.0.0.1
PORT=3000
PRIVATE_KEY_PATH=/home/user/YOUR FILE
CLIENT_ID=YOUR CLIENT ID
```

- install the project packages
```console
npm install
```
Start
===
```console
node index.js
```




