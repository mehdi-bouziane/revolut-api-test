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
let private_key_file = null
let config_file = 'config.json'
let config_data = null

//check config.json
try {
    if (fs.existsSync(config_file)) {
        config_data = JSON.parse (fs.readFileSync(config_file).toString())
    } else {
        console.error('configuration file not found')
        process.exit(1);
    }
  } catch(err) {
    console.error(err)
    process.exit(1);
  }

//check private key
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

/**
 * check if the tokens are still usable
*/

function checkAvailableToken (){
  let linkAuthorisationCode = 'https://sandbox-business.revolut.com/app-confirm?client_id='+client_id+'&redirect_uri=http://'+hostname_server+':'+port_server
  if (JSON.stringify(config_data) === '{}'){
    open (linkAuthorisationCode);
    console.log (`go to this link: ${linkAuthorisationCode}`)

  } else if ((config_data.last_authorisation_date + (((60*60)*24)*90)*1000) < Date.now()){ //90 days
    console.info ('a new authorization of access to the api is required')
    console.log (`go to this link: ${linkAuthorisationCode}`)
    open (linkAuthorisationCode);

  } else if ((config_data.last_refresh_date + ((60*40)*1000)) < Date.now()) { //40 minutes
    console.info ('the token needs to be refreshed')
    refreshAccessToken ()
  } else {
    listAccounts ()
  }
}


/**
 * Generate a token
 * return token
*/

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

/**
 * Send a https request
 * 
 * @param data
 * @param options : request options
 * @param response : res
*/
function sendRequest (data, options, response){
    const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)

        res.on('data', (d) => {
            if (res.statusCode === 200){
                if (typeof response !== 'undefined'){
                    response.json ({success: true, response: d.toString()})
                }
                console.log (d.toString())
                if (JSON.parse(d.toString()).access_token !== undefined){
                  overwriteConfFile(JSON.parse(d.toString()))
                  listAccounts ()
                }
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

/**
 * This endpoint is used to exchange an authorisation code with an access token. https://revolutdev.github.io/business-api/?shell--sandbox#exchange-authorisation-code
 * @param response : res
*/
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

/**
 * This endpoint is used to request a new user access token after the expiration date. https://revolutdev.github.io/business-api/?shell--sandbox#refresh-access-token
*/
function refreshAccessToken () {
    let token = generateToken()

    const tokenUrlHostname = 'sandbox-b2b.revolut.com' 
    const tokenUrlPath = '/api/1.0/auth/token'

    const data = qs.stringify({
      "grant_type": "refresh_token",
      "refresh_token": config_data.refresh_token,
      "client_id": client_id,
      "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
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

    sendRequest(data, options)
}

/**
 * This endpoint retrieves your accounts. https://revolutdev.github.io/business-api/?shell--sandbox#get-accounts
*/
function listAccounts () {
    console.info ('list all Accounts')
    const tokenUrlHostname = 'sandbox-b2b.revolut.com' 
    const tokenUrlPath = '/api/1.0/accounts'
    const access_token = config_data.access_token

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

/**
 * rewrite the data with the new configuration in the config.json file.
 * @param data_json : data received from the revolut server
*/
function overwriteConfFile(data_json) {
  if (data_json.access_token !== undefined){
      config_data.access_token = data_json.access_token
      config_data.last_refresh_date = Date.now()
  } 

  if (data_json.refresh_token !== undefined){
    config_data.refresh_token = data_json.refresh_token
    config_data.last_refresh_date = Date.now()
    config_data.last_authorisation_date = Date.now()
  }

  fs.writeFile(config_file, JSON.stringify(config_data), function (err) {
      if (err) throw err;
      console.log('Config file is successfully.');
    });
}

function test () {
  checkAvailableToken ()
}

test ()