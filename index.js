'use strict';
const express = require('express');
const app = express();
const http = require('http').Server(app);
const co = require('co');
const MongoClient = require('mongodb').MongoClient
const bodyParser = require('body-parser');
const path = require('path');
const cardsInfo = require('./cardsInfo.js');
const url = "mongodb://localhost:27017/gacha-statistics";
const io = require('socket.io')(http);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/statistics',express.static(path.join(__dirname,'statistics')));
app.use('/gameinfo',express.static(path.join(__dirname,'gameinfo')));
app.use(function(req,res,next){
            res.header("Access-Control-Allow-Origin","*");
            next();
})
app.get('/',function(req,res,next){
    res.send('Yeah');
});

app.post('/record',function(req,res,next){
    //console.log(req);
    if(!req.body) {
        res.sendStatus(400);
        return;
    }
    //判断数据合法性
    if(!req.body.id || !req.body.time || !req.body.gachatype || !req.body.user) {
        res.sendStatus(400);
        return;
    }
    co(function*(){
        let db = yield MongoClient.connect(url);
        let r = yield db.collection('records').insertOne(req.body);
        //Oversee 更新
        //let r1 = yield db.collection('records').updateOne({type:'oversee'},)
        //Socket.io发送（具体数据&Oversee）
        let obj = {
            time: (new Date(parseInt(req.body.time))).toLocaleString(),
            type: req.body.gachatype,
            user: req.body.user,
            card: {
                name: cardsInfo[req.body.id-1].name,
                rare: cardsInfo[req.body.id-1].rare
            }
         }
        io.to('user-' + req.body.user).emit('newRecord',obj);
        db.close();
        res.send('OK');
    }).catch(function(err){
        console.log(err.stack);
        res.sendStatus(501);
    });
});

app.post('/record/event/:eventid', function(req,res,next){
    //console.log(req);
    if(!req.body) {
        res.sendStatus(400);
        return;
    }
    //判断数据合法性
    if(!req.body.id || !req.body.time || !req.body.gachatype || !req.body.user) {
        res.sendStatus(400);
        return;
    }
    co(function*(){
        let db = yield MongoClient.connect(url);
        let r = yield db.collection('records').insertOne(req.body);
        let r1 = yield db.collection(req.params.eventid).insertOne(req.body);
        //Oversee 更新 两个目录中
        //let r1 = yield db.collection('records').updateOne({type:'oversee'},)
        //socket.io 发送 (Oversee && Event && user)
        let obj = {
            time: (new Date(parseInt(req.body.time))).toLocaleString(),
            event: req.params.eventid,
            type: req.body.gachatype,
            user: req.body.user,
            card: {
                name: cardsInfo[req.body.id-1].name,
                rare: cardsInfo[req.body.id-1].rare
            }
        }
        io.to('user-' + req.body.user).emit('newRecord',obj);
        io.to('event-' + req.params.eventid).emit('newEventRecord',obj);
        db.close();
        res.send('OK');
    }).catch(function(err){
        res.sendStatus(501);
    });
});

app.get('/record/:user',function(req,res,next){
    co(function*(){
        let db = yield MongoClient.connect(url);
        let col = db.collection('records');
        let docs = yield col.find({user:req.params.user},{_id:0}).toArray();
        db.close();
        if(docs.length == 0) {
            res.send('[]');
            return;
        }
        let arr = docs.map((item,index)=>{
            let obj = {
                time: (new Date(parseInt(item.time))).toLocaleString(),
                type: item.gachatype,
                user: item.user,
                card: {
                    name: cardsInfo[item.id-1].name,
                    rare: cardsInfo[item.id-1].rare
                }
            }
            return obj;
        });
        res.send(JSON.stringify(arr));
    }).catch(function(err){
        console.log(err.stack);
        res.sendStatus(501);
    });
});

app.get('/record/event/:eventid', function(req,res,next){
    co(function*(){
        let db = yield MongoClient.connect(url);
        let col = db.collection(req.params.eventid);
        let docs = yield col.find({},{_id:0}).toArray();
        db.close();
        if(docs.length == 0) {
            res.send('[]');
            return;
        }
        let arr = docs.map((item,index)=>{
            let obj = {
                time: (new Date(parseInt(item.time))).toLocaleString(),
                type: item.gachatype,
                user: item.user,
                card: {
                    name: cardsInfo[item.id-1].name,
                    rare: cardsInfo[item.id-1].rare
                }
            }
            return obj;
        });
        res.send(JSON.stringify(arr));
    }).catch(function(err){
        res.sendStatus(501);
    });
})

io.on('connection', function(socket){
    socket.on('join-user',(arg)=>{
        //先离开原来的房间
        if(socket.bindUser !== undefined) socket.leave('user-' + socket.bindUser);
        //再加入新房间
        socket.binduser = arg;
        socket.join('user-' + arg);
    });
    socket.on('join-event',(arg)=>{
        //先离开原来的房间
        if(socket.bindEvent !== undefined) socket.leave('user-' + socket.bindEvent);
        //再加入新房间
        socket.bindEvent = arg;
        socket.join('event-' + arg);
    });
});

http.listen('9980',function(){
    console.log('listening on *:9980');
});