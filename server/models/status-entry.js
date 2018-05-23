'use strict';
const Joi = require('joi');
const MongoModels = require('mongo-models');
const NewDate = require('joistick/new-date');


const schema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    timeCreated: Joi.date().default(NewDate(), 'time of creation'),
    adminCreated: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required()
    }).required()
}).label('Status-Entry object').example({
    id: 'asfsfsdf',
    name: 'asfsdsfsf',
    timeCreated: '2018-05-23T20:19:27Z',
    adminCreated: {
        id: 'asdfsadffds',
        name: 'username?'
    }
});


class StatusEntry extends MongoModels {}


StatusEntry.schema = schema;


module.exports = StatusEntry;
