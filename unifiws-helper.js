const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { HttpCookieAgent, HttpsCookieAgent } = require('http-cookie-agent/http');
const WebSocket = require('ws');

var ControllerWS = function (hostname, port, unifios, ssl, username, password, site, allowedMessages, allowedEvents) {

    var _self = this;
    _self._cookieJar = new CookieJar();
    _self._unifios = unifios;
    _self._ssl = ssl;
    _self._baseurl = 'https://127.0.0.1:8443';
    _self._username = username;
    _self._password = password;
    _self._site = site;

    if (typeof (hostname) !== 'undefined' && typeof (port) !== 'undefined') {
        _self._baseurl = 'https://' + hostname + ':' + port;
    }

    const jar = _self._cookieJar;
    const axiosinstance = axios.create({
        httpAgent: new HttpCookieAgent({ cookies: { jar } }),
        httpsAgent: new HttpsCookieAgent({ cookies: { jar }, rejectUnauthorized: _self._ssl, requestCert: true })
    });

    _self.loginws = async function (cb) {

        if (_self._unifios)
            url = _self._baseurl + '/api/auth/login';
        else
            url = _self._baseurl + '/api/login';

        axiosinstance.post(url, {
            username: _self._username,
            password: _self._password
        })
            .then(function (response) {
                if (response.headers['x-csrf-token']) {
                    axiosinstance.defaults.headers.common['x-csrf-token'] = response.headers['x-csrf-token'];
                }
            })
            .catch(function (error) {

            })
            .then(function () {

                jar.getCookieString(_self._baseurl).then(cookies => {
                    const baseurl = _self._baseurl.replace('https://', 'wss://')
                    var eventsUrl = baseurl + '/wss/s/<SITE>/events'.replace('<SITE>', _self._site);
                    if (_self._unifios)
                        eventsUrl = baseurl + '/proxy/network/wss/s/<SITE>/events'.replace('<SITE>', _self._site);

                    _ws = new WebSocket(eventsUrl, {
                        perMessageDeflate: false,
                        rejectUnauthorized: _self._ssl,
                        headers: {
                            Cookie: cookies
                        }
                    });

                    _ws.on('open', function open() {
                        if (typeof (cb) === 'function') {
                            cb(false, 'STATUS_CONNECTED');
                        }
                    });

                    _ws.on('message', function message(data) {
                        try {
                            const obj = JSON.parse(data);
                            if (allowedMessages.length === 0) {
                                // no filter, all messages are allowed
                                cb(false, obj);
                                return
                            }
                            if (allowedMessages.includes(obj.meta.message)) {
                                // this type of message is allowed
                                if (obj.meta.message == 'events') {
                                    // it is an event, apply an additional filter on the event key
                                    if (allowedEvents.includes(obj.data[0].key)) {
                                        cb(false, obj);
                                    }
                                } else {
                                    cb(false, obj);
                                }
                            }
                        } catch (error) {
                            // send back the error
                            cb(error);
                        }
                    });

                    _ws.on('error', function error(error) {
                        if (typeof (cb) === 'function') {
                            cb({ message: error });
                        }
                    });

                    _ws.on('close', function close() {
                        if (typeof (cb) === 'function') {
                            cb(false, 'STATUS_DISCONNECTED');
                        }
                    });
                })
            });
    };
};

exports.ControllerWS = ControllerWS;