const https = require('https')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const open = require('open')
const qs = require ('qs')

let express = require('express')
const app = express ();

let dotenv = require('dotenv');

dotenv.config();

if(process.env.HOSTNAME === undefined || process.env.PORT === undefined || process.env.PRIVATE_KEY_PATH === undefined ||
  process.env.CLIENT_ID === undefined){
  console.error('Error: You must define a valid .env file')
  process.exit(1)
}

//Global variable
let code = null;
let private_key_path = process.env.PRIVATE_KEY_PATH
let client_id = process.env.CLIENT_ID
let hostname_server = process.env.HOSTNAME
let port_server = process.env.PORT
let private_key_file = null;

open ('https://sandbox-business.revolut.com/app-confirm?client_id='+client_id+'&redirect_uri=http://'+hostname_server+':'+port_server, {app: 'firefox'});

try {
    if (fs.existsSync(private_key_path)) {
        private_key_file = fs.readFileSync(private_key_path);
    } else {
        console.error('enter a path for the private key')
        process.exit(1);
    }
  } catch(err) {
    console.error(err)
    process.exit(1);
  }

  listAccounts ()

app.get('/', function(req, res, next) {
    code = req.query.code
    if (!code) {
      // Code is required to obtain access token
      console.error ("code not found")
      listener.close ()
    } else {
      exchangeAuthorisationCode(res)
    }
  });

  const listener = app.listen(port_server, function() {
    console.log('app is listening on port ' + port_server);
  });

function generateToken (){
    const issuer = hostname_server
    const aud = 'https://revolut.com' // Constant
    const payload = {
        "iss": issuer,
        "sub": client_id,
        "aud": aud
    }
    const token = jwt.sign(payload, private_key_file, { algorithm: 'RS256', expiresIn: 60 * 60});

    return token;
}

function sendRequest (data, options, response){
    const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)

        res.on('data', (d) => {
            if (res.statusCode === 200){
                if (typeof response !== 'undefined'){
                    response.json ({success: true, response: d.toString()})
                }
                console.log (d.toString())
                //overwriteConfFile(d.toString(), Date.now(), Date.now())
            } else {
                if (typeof response !== 'undefined'){
                    response.json ({success: false, error: 'A problem has occurred', code: d})
                }
                console.error (d.toString());
            }
        })
    })
        
    req.on('error', (error) => {
        console.error(error)
    })
    
    req.write(data)
    req.end()
}

function exchangeAuthorisationCode (response) {
    let token = generateToken()

    const tokenUrlHostname = 'sandbox-b2b.revolut.com' 
    const tokenUrlPath = '/api/1.0/auth/token'

    const data = qs.stringify({
        "grant_type": "authorization_code",
        "code": code,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_id": client_id,
        "client_assertion": token,
      })

      const options = {
        hostname: tokenUrlHostname,
        path: tokenUrlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }

      sendRequest(data, options, response)
}

/*
function refreshAccessToken () {
    let token = generateToken()

    const tokenUrlHostname = 'sandbox-b2b.revolut.com' 
    const tokenUrlPath = '/api/1.0/auth/token'
} */

function listAccounts () {
    const tokenUrlHostname = 'sandbox-b2b.revolut.com' 
    const tokenUrlPath = '/api/1.0/accounts'
    const access_token = '********'

    const data = qs.stringify ({})

    const options = {
        hostname: tokenUrlHostname,
        path: tokenUrlPath,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer '+access_token,
        }
      }
      sendRequest(data, options)
}


  