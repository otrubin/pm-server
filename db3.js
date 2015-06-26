var mysql = require('mysql');
var async = require('async');
var crc32 = require('./utils/crc32');

var pool = null;

function getPool(){
    if(!pool){
        pool = mysql.createPool({
            host            : 'localhost',
            user            : 'smile_m_mysql',
            password        : 'qly6DhCk',
            database        : 'smile_m'
        });
    }
    return pool;
}

function Hit(hit_data){
    var _hit_data = hit_data;
    var _db_data = {};
    var _select_data = {};
    var _union_user_master = {};//при объединении юзеров здесь юзер, который должен остаться
    var _union_user_temp = {}; //при объединении юзеров здесь юзер, которого надо объединить


    function _selectPageId(callback){
        var sql = "SELECT ?? FROM ?? WHERE ?? = ? AND ?? = ?";
        var inserts = ['id', 'pages', 'account_id', _hit_data.account_id, 'url', _select_data.page];
        sql = mysql.format(sql, inserts);

        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, 'ERROR - _selectPageId');
                return;
            }
            if (results.length){
                _db_data.page = results[0].id;
                callback(null, '_selectPageId');
            }else{
            /* Если страничка не найдена, добавляем её */
                p.query('INSERT INTO pages SET ?', {
                    account_id: _hit_data.account_id,
                    url: _select_data.page
                }, function(err, result) {
                    if (err) {
                        console.error('Error page added: ' + err.stack);
                        callback(err, '_selectPageId - Error page added');
                    }else{
                        _db_data.page = result.insertId;
                        console.log('Page added, id - '+_db_data.page);
                        callback(null, '_selectPageId - Page added');
                    }
                });
            }
        });
    }

    function _writeHit(callback){
        var p = getPool();
        p.query('INSERT INTO hits SET ?', {
            account_id: _hit_data.account_id,
            user_id: _db_data.user.id,
            page_id: _db_data.page
        }, function(err, result) {
            if (err) {
                console.error('Error inserting: ' + err.stack);
                callback(err, '_writeHit');
            }else{
                console.log('_writeHit');
                callback(null, '_writeHit');
            }
        });
    }


    function _addUser(callback){
        if(_db_data.user){
            callback(null, '_addUser - User already exists');
            return;
        }
        var fields = {};

        /*аккаунт ИД должен быть у каждого юзера*/
        fields.account_id = _hit_data.account_id;

        /*уникальный идентификатор должен быть у каждого юзера*/
        if(!_hit_data.uid){
            _hit_data.uid = crc32.hash('' + new Date().getTime() + Math.random());
        }
        fields.uid = _hit_data.uid;

        /*если есть email*/
        if(_hit_data.email){
            fields.email = _hit_data.email;
            var hash = crc32.hash(_hit_data.email);
            fields.email_crc32 = hash;
        }

        var p = getPool();
        p.query('INSERT INTO users SET ?', fields, function(err, result) {
            if (err) {
                callback(err, 'ERROR - _addUser');
            }else{
                _db_data.user = {};
                _db_data.user.id = result.insertId;
                _db_data.user.uid = _hit_data.uid;
                if(_hit_data.email){
                    _db_data.user.email = _hit_data.email;
                }
                callback(null, 'User added');
            }
        });
    }


    function _changeIdForTempUser(callback){
        var sql = "UPDATE ?? SET user_id=? WHERE user_id=?";
        var inserts = ['hits', _union_user_master.id, _union_user_temp.id];
        sql = mysql.format(sql, inserts);

        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, '_changeIdForTempUser - Noooo');
            }else{
                console.log('changed ' + results.changedRows + ' rows');
                callback(null, '_changeIdForTempUser - Yeeess');
            }
        });
    }

    function _deleteTempUser(callback){
        var sql = "DELETE FROM ?? WHERE id=?";
        var inserts = ['users', _union_user_temp.id];
        sql = mysql.format(sql, inserts);

        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, '_deleteTempUser - Noooo');
            }else{
                console.log('deleted ' + results.affectedRows + ' rows');
                callback(null, '_deleteTempUser - Yeeess');
            }
        });
    }


    function _changeUserIntoDB(callback){
        if(!_db_data.user || !_db_data.user.changed){
            callback(null, '_changeUserIntoDB - User not changed');
            return;
        }
        var fields = {};
        fields.uid = _db_data.user.uid;
        fields.email = _db_data.user.email;
        var hash = crc32.hash(_db_data.user.email);
        fields.email_crc32 = hash;

        var sql = "UPDATE ?? SET ? WHERE id=?";
        var inserts = ['users', fields, _db_data.user.id];
        sql = mysql.format(sql, inserts);


        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, '_changeUserIntoDB - Noooo');
            }else{
                console.log('changed ' + results.changedRows + ' rows');
                callback(null, '_changeUserIntoDB - Yeeess');
            }
        });
    }


    function _checkEmailAndUidUser(callback){
        // Если юзер в бд не найден
        if(!_db_data.user){
            callback(null, '_checkEmailAndUidUser - User not found');
            return;
        }
        //Если найден ТОЛЬКО по uid
        if(!_db_data.user.email){
            _db_data.user.email = _hit_data.email;
            _db_data.user.changed = true;//признак того, что нужно записать измененного юзера в базу
            callback(null, '_checkEmailAndUidUser - uid only');
            return;
        }
    // найден email
    // ВНИМАНИЕ: поиск по e-mail первичен, по uid вторичен
        //сравниваем uid запроса с uid найденным в базе
        //если uid-ы НЕ равны, это значит, надо поискать в базе юзера с _hit_data.uid
        // Если он будет найден, это значит, что этот юзер в базе был, но, к примеру, ранее он заходил с другого браузера
        // и поэтому надо объединить обоих юзеров.
        if(_db_data.user.uid != _hit_data.uid){
            //запоминаем ранее найденного юзера во временную переменную
            var temp_user = _db_data.user;
            _db_data.user = null;
            // устанавливаем критерий для поиска
            _select_data.uid = _hit_data.uid;
            async.series([
                _getUserFromUid
            ], function(err, results){
                /*
                * Если найден юзер с uid переданным в запросе
                * это временный юзер, его надо объединить с юзером,
                * ранее найденным в базе по email
                * */
                if (_db_data.user){
                    _union_user_master = temp_user;
                    _union_user_temp = _db_data.user;

                    async.parallel([
                        _changeIdForTempUser,
                        _deleteTempUser
                    ], function(err, results){
                        _db_data.user = temp_user;
                        callback(err, results);
                    });
                }else{
                    /*
                    * Если юзер с uid из запроса не найден, то
                    * все в порядке, это юзер первый раз зашел с другого браузера,
                    * надо просто переписать куку с uid в браузере
                    * */
                    _db_data.user = temp_user;
                    callback(null, '_checkEmailAndUidUser - email & uid - need change uid into browser');
                }

            });
        }else{
            callback(null, '_checkEmailAndUidUser - email & uid - all OK');
        }
    }

    function _getUserFromUid(callback){
        var out = ['id', 'email', 'uid'];
        var sql = "SELECT ?? FROM ?? WHERE uid =? AND account_id = ?";
        var inserts = [out, 'users', _select_data.uid, _hit_data.account_id];
        sql = mysql.format(sql, inserts);

        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, '_getUserFromUid - Error');
                return;
            }

            if(results.length){
                _db_data.user = results[0];
                callback(null, '_getUserFromUid - Yeeesss');
            }else{
                _db_data.user = null;
                callback(null, '_getUserFromUid - Noooo');
            }
        });
    }

    function _getUserFromEmail(callback){
        _select_data.email_crc32 = crc32.hash(_select_data.email);
        var out = ['id', 'email', 'uid'];
        var sql = "SELECT ?? FROM ?? WHERE email_crc32 =? AND account_id = ?";
        var inserts = [out, 'users', _select_data.email_crc32, _hit_data.account_id];
        sql = mysql.format(sql, inserts);

        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, '_getUserFromEmail - Error');
                return;
            }

            if(results.length){
                _db_data.user = results[0];
                callback(null, '_getUserFromEmail - Yeeesss');
            }else{
                _db_data.user = null;
                callback(null, '_getUserFromEmail - Noooo');
            }
        });
    }

    function _getUserFromEmailAndUid(callback){
        _select_data.email_crc32 = crc32.hash(_select_data.email);
        var out = ['id', 'email', 'uid'];
        var sql = "SELECT ?? FROM ?? WHERE (email_crc32 = ? OR uid =?) AND account_id = ?";
        var inserts = [out, 'users', _select_data.email_crc32, _select_data.uid, _hit_data.account_id];
        sql = mysql.format(sql, inserts);

        var p = getPool();
        p.query(sql, function(err, results) {
            if (err) {
                callback(err, '_getUserFromEmailAndUid - Error');
                return;
            }

            if(results.length){
                _db_data.user = results[0];
                callback(null, '_getUserFromEmailAndUid - Yeees');
            }else{
                _db_data.user = null;
                callback(null, '_getUserFromEmailAndUid - Noooo');
            }

        });
    }

    function _getUser(callback){
        _db_data.user = null;
        if (_hit_data.uid && _hit_data.email){
            //Задаем параметры, которые будут использоваться в поиске
            _select_data.email = _hit_data.email;
            _select_data.uid = _hit_data.uid;

            async.series([
                _getUserFromEmailAndUid,
                _checkEmailAndUidUser,
                _addUser,
                _changeUserIntoDB
            ], function(err, results){
                console.log('33333333');
                callback(err, results);
            });

        }else if(_hit_data.email){
            _select_data.email = _hit_data.email;
            async.series([
                _getUserFromEmail,
                _addUser
            ], function(err, results){
                console.log('55555555');
                callback(err, results);
            });
        }else if(_hit_data.uid){
            _select_data.uid = _hit_data.uid;
            async.series([
                _getUserFromUid,
                _addUser
            ], function(err, results){
                console.log('44444444');
                callback(err, results);
            });
        }else{
            async.series([
                _addUser
            ], function(err, results){
                console.log('66666666');
                callback(err, results);
            });
        }
    }

    this.hit = function(callback){
        // ID аккаунта обязательный параметр. Без него ничего не пишем
        if(!_hit_data.account_id){
            return;
        }
        //Задаем параметры, которые будут использоваться в поиске
        _select_data.page = _hit_data.page;

        async.series([
            _selectPageId,
            _getUser,
            _writeHit
        ], function(err, results){
            console.log(arguments);
            var res = {};
            if (_db_data.user.uid){
                res.uid = _db_data.user.uid;
            }
            if (_db_data.user.email){
                res.email = _db_data.user.email;
            }
            callback(res);
        });
    };

    this.test = function(){
        async.series([
            _getUserFromUid,
            _addUser
        ], function(err, results){
            console.log(results);
        });
        console.log('Test end');
    };

    this.test_changeIdForTempUser = function(){
        _union_user_master = {id:6};
        _union_user_temp = {id:1};
        async.series([
            _changeIdForTempUser
        ], function(err, results){
            console.log(results);
        });
    };

    this.test_deleteTempUser = function(){
        _union_user_temp = {id:9};
        async.series([
            _deleteTempUser
        ], function(err, results){
            console.log(results);
        });
    };

    this.test_getUser = function(){
        async.series([
            _getUser
        ], function(err, results){
            console.log(results);
        });
    };

    this.test_changeUserIntoDB = function(){
        _db_data.user = {};
        _db_data.user.email = 'zzz@zz.zz';
        _db_data.user.uid = -331338888;
        _db_data.user.id = 13;
        _db_data.user.changed = true;
        async.series([
            _changeUserIntoDB
        ], function(err, results){
            console.log(results);
        });
    };

    this.test_selectPageId = function(){
        _select_data.page = _hit_data.page;
        async.series([
            _selectPageId
        ], function(err, results){
            console.log(results);
        });
    };
}

exports.Hit = Hit;