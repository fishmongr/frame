'use strict';
const Account = require('../models/account');
const Boom = require('boom');
const Joi = require('joi');
const NoteEntry = require('../models/note-entry');
const Preware = require('../preware');
const Status = require('../models/status');
const StatusEntry = require('../models/status-entry');
const User = require('../models/user');


const register = function (server, serverOptions) {

    server.route({
        method: 'GET',
        path: '/api/accounts',
        options: {
            tags: ['api','accounts'],
            description: 'Get a paginated list of all accounts (need admin role)',
            notes: 'This endpoint returns a paginated list of accounts that have been created. This is a much longer detailed description if we have answers to common questions, but I mainly have questions. Whats the difference between accounts and users? When would you want to list all accounts instead of all users? Assuming you need an admin role to use this endpoint? Where is that configured?',
            auth: {
                scope: 'admin'
            },
            validate: {
                query: {
                    sort: Joi.string().default('_id').description('This is a description for this query parameter. This is obviously a sort but what are the allowed values in the default setup? I\'ve added an example allow() validation which will show up as a pick list in interactive docs.').allow('_id', '_option2', '_option3'),
                    limit: Joi.number().integer().default(20).description('I\'m assuming this is how many results you want at a time per page? We should mention that just so it\'s clear. It should also have min/max Joi validation which also shows up in docs. I\'ve added an example.').min(1).max(1000),
                    page: Joi.number().integer().default(1).description('Looks like default is 1 so this is a 1 based index not a zero based index right? We should state stuff like that here.').min(1).max(1000)
                }
            },
            response: {
              schema: Joi.object({
                results: Joi.array().items(
                  Account.schema
                ).label('Array of Account objects').required()
              }).label('Accounts List Response Model').description('Returns a list of accounts.')
            }
        },
        handler: async function (request, h) {

            const query = {};
            const limit = request.query.limit;
            const page = request.query.page;
            const options = {
                sort: Account.sortAdapter(request.query.sort)
            };

            return await Account.pagedFind(query, page, limit, options);
        }
    });


    server.route({
        method: 'POST',
        path: '/api/accounts',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    name: Joi.string().required()
                }
            }
        },
        handler: async function (request, h) {

            return await Account.create(request.payload.name);
        }
    });


    server.route({
        method: 'GET',
        path: '/api/accounts/{id}',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            }
        },
        handler: async function (request, h) {

            const account = await Account.findById(request.params.id);

            if (!account) {
                throw Boom.notFound('Account not found.');
            }

            return account;
        }
    });


    server.route({
        method: 'PUT',
        path: '/api/accounts/{id}',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    name: Joi.object({
                        first: Joi.string().required(),
                        middle: Joi.string().allow(''),
                        last: Joi.string().required()
                    }).required()
                }
            }
        },
        handler: async function (request, h) {

            const id = request.params.id;
            const update = {
                $set: {
                    name: request.payload.name
                }
            };
            const account = await Account.findByIdAndUpdate(id, update);

            if (!account) {
                throw Boom.notFound('Account not found.');
            }

            return account;
        }
    });


    server.route({
        method: 'DELETE',
        path: '/api/accounts/{id}',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            pre: [
                Preware.requireAdminGroup('root')
            ]
        },
        handler: async function (request, h) {

            const account = await Account.findByIdAndDelete(request.params.id);

            if (!account) {
                throw Boom.notFound('Account not found.');
            }

            return { message: 'Success.' };
        }
    });


    server.route({
        method: 'PUT',
        path: '/api/accounts/{id}/user',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    username: Joi.string().lowercase().required()
                }
            },
            pre: [{
                assign: 'account',
                method: async function (request, h) {

                    const account = await Account.findById(request.params.id);

                    if (!account) {
                        throw Boom.notFound('Account not found.');
                    }

                    return account;
                }
            }, {
                assign: 'user',
                method: async function (request, h) {

                    const user = await User.findByUsername(request.payload.username);

                    if (!user) {
                        throw Boom.notFound('User not found.');
                    }

                    if (user.roles.account &&
                        user.roles.account.id !== request.params.id) {

                        throw Boom.conflict('User is linked to an account. Unlink first.');
                    }

                    if (request.pre.account.user &&
                        request.pre.account.user.id !== `${user._id}`) {

                        throw Boom.conflict('Account is linked to a user. Unlink first.');
                    }

                    return user;
                }
            }]
        },
        handler: async function (request, h) {

            const user = request.pre.user;
            let account = request.pre.account;

            [account] = await Promise.all([
                account.linkUser(`${user._id}`, user.username),
                user.linkAccount(`${account._id}`, account.fullName())
            ]);

            return account;
        }
    });


    server.route({
        method: 'DELETE',
        path: '/api/accounts/{id}/user',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            pre: [{
                assign: 'account',
                method: async function (request, h) {

                    let account = await Account.findById(request.params.id);

                    if (!account) {
                        throw Boom.notFound('Account not found.');
                    }

                    if (!account.user || !account.user.id) {
                        account = await account.unlinkUser();

                        return h.response(account).takeover();
                    }

                    return account;
                }
            }, {
                assign: 'user',
                method: async function (request, h) {

                    const user = await User.findById(request.pre.account.user.id);

                    if (!user) {
                        throw Boom.notFound('User not found.');
                    }

                    return user;
                }
            }]
        },
        handler: async function (request, h) {

            const [account] = await Promise.all([
                request.pre.account.unlinkUser(),
                request.pre.user.unlinkAccount()
            ]);

            return account;
        }
    });


    server.route({
        method: 'POST',
        path: '/api/accounts/{id}/notes',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    data: Joi.string().required()
                }
            }
        },
        handler: async function (request, h) {

            const id = request.params.id;
            const admin = request.auth.credentials.roles.admin;
            const newNote = new NoteEntry({
                data: request.payload.data,
                adminCreated: {
                    id: `${admin._id}`,
                    name: admin.fullName()
                }
            });
            const update = {
                $push: {
                    notes: newNote
                }
            };
            const account = await Account.findByIdAndUpdate(id, update);

            if (!account) {
                throw Boom.notFound('Account not found.');
            }

            return account;
        }
    });


    server.route({
        method: 'POST',
        path: '/api/accounts/{id}/status',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    status: Joi.string().required()
                }
            },
            pre: [{
                assign: 'status',
                method: async function (request, h) {

                    const status = await Status.findById(request.payload.status);

                    if (!status) {
                        throw Boom.notFound('Status not found.');
                    }

                    return status;
                }
            }]
        },
        handler: async function (request, h) {

            const id = request.params.id;
            const admin = request.auth.credentials.roles.admin;
            const newStatus = new StatusEntry({
                id: `${request.pre.status._id}`,
                name: request.pre.status.name,
                adminCreated: {
                    id: `${admin._id}`,
                    name: admin.fullName()
                }
            });
            const update = {
                $set: {
                    'status.current': newStatus
                },
                $push: {
                    'status.log': newStatus
                }
            };
            const account = await Account.findByIdAndUpdate(id, update);

            if (!account) {
                throw Boom.notFound('Account not found.');
            }

            return account;
        }
    });


    server.route({
        method: 'GET',
        path: '/api/accounts/my',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'account'
            }
        },
        handler: async function (request, h) {

            const id = request.auth.credentials.roles.account._id;
            const fields = Account.fieldsAdapter('user name timeCreated');

            return await Account.findById(id, fields);
        }
    });


    server.route({
        method: 'PUT',
        path: '/api/accounts/my',
        options: {
            tags: ['api','accounts'],
            auth: {
                scope: 'account'
            },
            validate: {
                payload: {
                    name: Joi.object({
                        first: Joi.string().required(),
                        middle: Joi.string().allow(''),
                        last: Joi.string().required()
                    }).required()
                }
            }
        },
        handler: async function (request, h) {

            const id = request.auth.credentials.roles.account._id;
            const update = {
                $set: {
                    name: request.payload.name
                }
            };
            const options = {
                fields: Account.fieldsAdapter('user name timeCreated')
            };

            return await Account.findByIdAndUpdate(id, update, options);
        }
    });
};


module.exports = {
    name: 'api-accounts',
    dependencies: [
        'auth',
        'hapi-auth-basic',
        'hapi-mongo-models'
    ],
    register
};
