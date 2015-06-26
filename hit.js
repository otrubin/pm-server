var http = require('http');
var url = require('url');
var db = require('./db3');

/**
 * Валидация email введенного пользователем
 * @param emailAddress {string} емайл
 * @returns {boolean}
 */
function isValidEmailAddress(emailAddress) {
    var pattern = new RegExp(/^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i);
    return pattern.test(emailAddress);
}

var server = new http.Server(function(req, res) {

    //адрес странички на которую перешел посетитель
    var ref_parsed = url.parse(req.headers.referer, true);
    var page = ref_parsed.hostname + ref_parsed.pathname;// без протокола

    //получаем данные, переданные из браузера
    var url_parsed = url.parse(req.url, true);
    var input_data = JSON.parse(url_parsed.query.data);

    if (input_data.em){
        if(!isValidEmailAddress(input_data.em)){
            input_data.em = undefined;
        }
    }

    var hit_data = {
        page: page,
        account_id: input_data.account_id,
        email: input_data.em,
        uid: input_data.uid
    };
    console.log(hit_data);

    var wh = new db.Hit(hit_data);
    wh.hit(function (result){
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        var r = url_parsed.query.callback + '(' + JSON.stringify(result) + ')';
        res.end(r);
    });
});

server.listen(1337, '0.0.0.0');