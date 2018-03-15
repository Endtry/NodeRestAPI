"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//import { API } from '../api';
const sql = require('mssql');
class MSSQLWrapper {
    constructor(options, table) {
        this.options = options;
        this.table = table;
        Object.assign(this, this.options);
    }
    connect(config) {
        this.client = new sql.Connection(config);
        return this.client.connect().then(() => {
            console.log('connected');
            //this.query(`select * from AAAddress`, (err: any, resp: any) => {
            //console.log('resp', resp);
            //});
            return true;
        }).catch((err) => {
            console.log('mssql connection err', err);
            return err;
        });
    }
    // callback is a function that takes a client as arguement and return a query result 
    exec(req, res, next, callback) {
        // takes in client and done as arguements
        this.client.request.query(callback);
    }
    query(query, callback) {
        return new sql.Request(this.client).query(query, (err, resp) => {
            console.log('from query...');
            callback(err, resp); // TODO callback with both err and resp object
        });
    }
    prepareCreate(props) {
        const obj = props;
        let arr = [];
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                //console.log('objkehy', obj[key]);
                let type = obj[key].type != null ? obj[key].type : false, unique = obj[key].unique != null ? obj[key].unique : false, keyType = obj[key].key != null ? obj[key].key : false, maxLength = obj[key].maxlength != null ? obj[key].maxlength : 100, // default to 50
                defaultVal = obj[key].default != null ? obj[key].default : false, foreignTable = obj[key].references != null ? obj[key].references.table : false, foreignKey = obj[key].references != null ? obj[key].references.foreignKey : false, onDelete = obj[key].onDelete != null ? obj[key].onDelete : false, onUpdate = obj[key].onUpdate != null ? obj[key].onUpdate : false;
                //console.log('type', type, 'keyType', keyType);
                let str = ``;
                switch (true) {
                    case type == Number && (keyType === 'primary'):
                        arr.push(`"${key}" serial PRIMARY KEY`);
                        break;
                    case type == Number && (keyType === 'foreign'):
                        str = `"${key}" integer references "${foreignTable}"("${foreignKey}")`;
                        onDelete ? str += ` on delete ${onDelete}` : false;
                        onUpdate ? str += ` on update ${onUpdate}` : false;
                        unique ? str += ` unique` : false;
                        arr.push(str);
                        break;
                    case type == Number && (keyType == false):
                        str = `"${key}" integer`;
                        unique ? str += ` unique` : false;
                        arr.push(str);
                        break;
                    case type == String:
                        str = `"${key}" varchar(${maxLength})`;
                        unique ? str += ` unique` : false;
                        arr.push(str);
                        break;
                    case type == Boolean:
                        str = `"${key}" boolean default ${defaultVal}`;
                        unique ? str += ` unique` : false;
                        arr.push(str); //default to true
                        break;
                    case type == Date:
                        str = `"${key}" timestamp`;
                        unique ? str += ` unique` : false;
                        arr.push(str); //default to true
                        break;
                    default:
                        str = `"${key}" varchar(${maxLength})`;
                        unique ? str += ` unique` : false;
                        arr.push(str);
                        break;
                }
            }
        }
        ;
        return arr.join(',');
    }
    createTable(schema, callback) {
        let checkIfExist = `select count(*) from pg_class where relname='${this.table}' and relkind='r'`;
        this.query(checkIfExist, (resp) => {
            if (!resp) {
                return { error: `there were errors creating table: ${this.table}` };
            }
            else {
                let count = resp.rows[0].count;
                if (count == 1) {
                    console.log(`${this.table} exists...`);
                    callback({ errorCode: 500, errorMessage: `${this.table} already exists!` });
                }
                else {
                    // create the table because it does not exist... TODO
                    let createQuery = `create table "${this.table}"(${this.prepareCreate(schema)})`;
                    //console.log('createQuery', createQuery);
                    this.query(createQuery, (resp) => {
                        if (resp && resp.name == 'error') {
                            callback({ errorCode: 500, errorMessage: `${this.table} could not be created! Please check the schema specs.` });
                        }
                        else {
                            callback({ statusCode: 200, message: `Success! Table ${this.table} was successfully created.` });
                        }
                    });
                }
            }
        });
    }
    getAll(req, res, next, callback) {
        this.exec(req, res, next, (client, done) => {
            client.query(`SELECT * FROM "${this.table}" ORDER BY id ASC;`, (err, resp) => {
                done(err);
                if (err) {
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    //return res.json(resp.rows);
                    callback(resp.rows);
                }
            });
        });
    }
    findById(req, res, next, callback) {
        this.exec(req, res, next, (client, done) => {
            client.query(`SELECT * FROM "${this.table}" WHERE id=${req.params.id};`, (err, resp) => {
                done(err);
                if (err) {
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    callback(resp.rows[0]);
                }
            });
        });
    }
    insert(req, res, next, callback) {
        const payload = req.body;
        let attrs = '', values = '', i = 0, fields = Object.keys(payload);
        for (let key in payload) {
            attrs += `"${key}", `;
            values += `${this.convert(payload[key])}, `;
            i++;
        }
        //attrs = attrs.slice(0, attrs.length - 2);
        //values = values.slice(0, values.length - 2);
        attrs += `"created_at", "updated_at"`;
        values += `'${this.convertToUTCDate(new Date().toISOString())}',
                    '${this.convertToUTCDate(new Date().toISOString())}'`; // add createdAt
        //console.log('attr: ', attrs);
        //console.log('values ', values);
        let query = `INSERT into "${this.table}" (${attrs}) VALUES(${values}) RETURNING id;`;
        console.log('query', query);
        this.exec(req, res, next, (client, done) => {
            client.query(query, (err, resp) => {
                done(err);
                if (err) {
                    //console.log('err', err);
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    client.query(`SELECT * FROM "${this.table}" where id=${resp.rows[0].id}`, (err, resp) => {
                        done(err);
                        //console.log('resp', resp);
                        callback(resp.rows[0]);
                        //return res.json(resp.rows[0]);
                    });
                }
            });
        });
    }
    update(req, res, next, callback) {
        const bundle = req.body;
        let keyValues = this.prepareObject(bundle);
        //console.log('keyValues', keyValues);
        let query = `UPDATE "${this.table}" SET ${keyValues} where id=${req.params.id};`;
        console.log('query', query);
        this.exec(req, res, next, (client, done) => {
            client.query(query, (err, resp) => {
                done(err);
                if (err) {
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    //console.log('resp from update', resp);
                    this.findById(req, res, next, (data) => {
                        // return res.json(data);
                        callback(data);
                    });
                }
            });
        });
    }
    get(req, res, next, callback) {
        let leftAlias = `_${this.table.toLowerCase()}`, query = `SELECT `, select = req.body.get != null ? this.prepareSelect(leftAlias, req.body.get) : false, join;
        let options = {
            query: [],
            joinType: [],
            where: [],
            group: []
        }, includes = [];
        if (req.body.join != null) {
            console.log('here......');
            // joinOption = req.body.join[0].joinType;
            join = this.prepareJoins(leftAlias, req.body.join, options, includes);
        }
        let where = '';
        let group = '';
        let sort = '';
        let limit = null;
        req.body.where != null ? where = this.prepareWhere(leftAlias, req.body.where) : false;
        req.body.group != null ? group = this.prepareGroup(leftAlias, req.body.group, select) : false;
        req.body.sort != null ? sort = this.prepareSort(leftAlias, req.body.sort) : false;
        req.body.limit != null ? limit = req.body.limit : false;
        if (join) {
            if (join.group && group.length > 0) {
                group += `,${join.group}`;
            }
            else if (join.group) {
                group += `${join.group}`;
            }
        }
        //join.group && group.length > 0 ? group += `,${join.group}` : false;
        //join.group && group.length > 0 ? group += `,${join.group}` : false;
        delete req.body.where;
        if (select[0] == "*") {
            query += `* ${join ? join.include : ''} FROM "${this.table}" as "${leftAlias}"`;
        }
        else {
            query += select + `${join ? join.include : ''} FROM "${this.table}" as "${leftAlias}"`;
        }
        join ? query += ` ${join.query}` : false;
        join && join.where.length > 0 ? query += ` AND ${join.where}` : false;
        where ? query += ` WHERE ${where}` : false;
        group ? query += ` GROUP BY ${group}` : false;
        sort ? query += ` ORDER BY ${sort}` : false;
        limit ? query += ` LIMIT ${limit}` : false;
        console.log('query', query);
        this.exec(req, res, next, (client, done) => {
            client.query(query, (err, resp) => {
                done(err);
                if (err) {
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    callback(resp);
                }
            });
        });
    }
    updateSet(req, res, next, callback) {
        const bundle = req.body;
        let leftAlias = `_${this.table.toLowerCase()}`, where = req.body.where != null ? this.prepareWhere(leftAlias, req.body.where) : false, keyValues = this.prepareObject(bundle), query = `UPDATE "${this.table}" as ${leftAlias} SET ${keyValues} WHERE ${where} RETURNING id;`;
        delete req.body.where;
        console.log('query', query);
        this.exec(req, res, next, (client, done) => {
            client.query(query, (err, resp) => {
                done(err);
                console.log('here.........');
                if (err) {
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    let affectedRows = resp.rows.map((row) => {
                        return row.id;
                    });
                    console.log('affectedRows', affectedRows);
                    // if more than one record is affected, find and return all the records
                    if (affectedRows.length > 0) {
                        this.query(`SELECT * FROM "${this.table}" WHERE id in (${affectedRows})`, (data) => {
                            console.log(data);
                            callback(data.rows);
                        });
                    }
                    else {
                        callback({ result: `No records affected!` }); // empty array
                    }
                }
            });
        });
    }
    delete(req, res, next, callback) {
        this.exec(req, res, next, (client, done) => {
            client.query(`DELETE FROM "${this.table}" WHERE id=${req.params.id};`, (err, resp) => {
                done(err);
                if (err) {
                    return res.status(500).json({ statusCode: 500, errorMessage: err });
                }
                else {
                    callback(resp);
                }
            });
        });
    }
    convert(value) {
        if (value != null) {
            let isArray = value.constructor === Array;
            if (isArray) {
                return `'${value.join()}'`; // turn array of string into a single comma separated string.
            }
            else {
                switch (typeof value) {
                    case 'number':
                        return parseInt(value);
                    case 'string':
                        return `'${value.trim()}'`;
                    case 'object':
                        return value;
                    case 'boolean':
                        return value;
                    case null:
                        return null;
                    default:
                        return value;
                }
            }
        }
        else {
            return value;
        }
    }
    // split object into key vaule string
    prepareObject(props) {
        const obj = props;
        let arr = [];
        for (let key in obj) {
            console.log('hey', key);
            if (obj.hasOwnProperty(key) && key != 'where') {
                arr.push(`"${key}"=${this.convert(obj[key])}`);
            }
        }
        return arr.join(',');
    }
    prepareOnClause(array) {
        //const arr = array;
        let arr = [];
        for (let item in array) {
            let obj = array[item];
            //console.log('obj------>', obj);
            let table1 = Object.keys(obj)[0];
            let table2 = Object.keys(obj)[1];
            let table1Key = obj[table1];
            let table2Key = obj[table2];
            arr.push(`"_${table1.toLowerCase()}"."${table1Key}"="_${table2.toLowerCase()}"."${table2Key}"`);
        }
        //let onClause = ` AND ` + arr.join(' AND ');
        //console.log('onCluase from lll', onClause);
        // return onClause;
        //arr = arr.join(' AND ');
        return arr.join(' AND ');
    }
    prepareSelect(leftAlias, array) {
        let arr = [];
        if (array[0] == "*") {
            arr.push(`"${leftAlias}".${array[0]}`);
        }
        else {
            for (let i in array) {
                if (array.hasOwnProperty(i)) {
                    arr.push(`"${leftAlias}"."${array[i]}"`);
                }
            }
            ;
        }
        return arr.join(', ');
    }
    prepareWhere(leftAlias, props) {
        const obj = props;
        let arr = [];
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                let childObj = obj[key];
                if (key == 'like') {
                    for (let prop in childObj) {
                        arr.push(`"${leftAlias}"."${prop}" ~ ${this.convert(childObj[prop])}`);
                    }
                }
                else if (key == 'in') {
                    for (let inArr in childObj) {
                        let str = ``;
                        for (let s in childObj[inArr]) {
                            str += `${this.convert(childObj[inArr][s])}, `;
                        }
                        str = str.slice(0, str.length - 2);
                        arr.push(`"${leftAlias}"."${inArr}" in (${str})`);
                    }
                }
                else {
                    arr.push(`"${leftAlias}"."${key}"=${this.convert(obj[key])}`);
                }
            }
        }
        ;
        return arr.join(' AND ');
    }
    prepareGroup(leftAlias, props, select) {
        const obj = props;
        let arr = [], selected = select.split(', '), output = '';
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                arr.push(`"${leftAlias}"."${obj[i]}"`);
            }
        }
        ;
        arr.filter((item) => {
            return selected.indexOf(item);
        });
        return arr.join(', ');
    }
    prepareSort(leftAlias, props) {
        const obj = props;
        let arr = [];
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                arr.push(`"${leftAlias}"."${key}" ${obj[key]}`);
            }
        }
        ;
        return arr.join(', ');
    }
    prepareJoins(leftAlias, joins, options, includes) {
        joins.forEach((props) => {
            this.prepareJoin(leftAlias, props, options, includes);
        });
        let query = options['query'].join(` `);
        let where = ``;
        let group = ``;
        //options['where'].length > 0 ? where += ` AND ` : false;
        options['where'].length > 0 ? where += options['where'].join(` AND `) : false;
        options['group'].length > 0 ? group += options['group'].join(`, `) : false;
        console.log('group', options['group']);
        //let where = options['where'].join(` `);
        // let test = options['item'].map((join:any, index:number, array:Array<any>) => {
        // console.log('i', join);
        // return join + ` ${options['option'][index]} `
        //});
        //console.log('where', where);
        let include = includes.join('');
        return {
            query: query,
            include: include,
            where: where,
            group: group
        };
    }
    prepareJoin(leftAlias, props, options, includes) {
        const obj = props;
        // let arr: Array<any> = [];
        //console.log('obj', obj);
        //let table = Object.keys(obj)[0];
        //console.log('include.....', obj['include']);
        let count = options['query'].length;
        let table = obj['table'];
        let include = obj['include'] != null ? obj['include'] : true;
        let joinType = obj['joinType'] != null ? obj['joinType'] : "INNER JOIN";
        let foreignKey = obj['foreignKey'] != null ? obj['foreignKey'] : false;
        let alias = `_${table.toLowerCase()}`;
        let asProp = obj['as'];
        let on = obj['on'];
        let where = '';
        let get;
        let onClause = '';
        let returnType = obj['returnType'] != null ? obj['returnType'] : 'array';
        let needSubQuery = obj['get'] != null && obj['get'][0] != "*";
        let group = obj['group'] != null ? obj['group'] : [];
        //on != null ? onClause = this.prepareOnClause(on) : false;
        if (on != null) {
            onClause = this.prepareOnClause(on);
            if (foreignKey) {
                onClause = `"${leftAlias}"."id"="${alias}"."${foreignKey}" AND ` + onClause;
            }
        }
        else {
            onClause = `"${leftAlias}"."id"="${alias}"."${foreignKey}"`;
        }
        //foreignKey ? onClause = `"${leftAlias}"."id"="${alias}"."${foreignKey}" AND ` + onClause : false;
        get = needSubQuery ? this.prepareSelect(alias, obj['get']) : returnType == 'array' ? `DISTINCT "${alias}".*` : ` "${alias}".*`;
        obj['where'] != null ? where = this.prepareWhere(alias, obj['where']) : false; // optional
        //console.log('onClause', onClause);
        let query = `${joinType} "${table}" as "${alias}" ON (${onClause.length > 0 ? onClause : ''})`;
        options['query'].push(`${joinType} "${table}" as "${alias}" ON (${onClause.length > 0 ? onClause : ''} )`);
        needSubQuery ? options['group'].push(this.prepareGroup(alias, group, get)) : false;
        obj['where'] != null ? options['where'].push(`${where}`) : false;
        console.log('where from asdfasdfasdfasdf', where.length);
        let subsWhere = where.length > 0 ? ` WHERE ` + where : '';
        let subs = needSubQuery ? `(select view from (select ${get} from "${table}" ${subsWhere} limit 1 ) as view)` : '';
        //console.log('onclude -------', include);
        console.log('subswhere', subsWhere);
        if (include) {
            if (returnType == 'object') {
                !needSubQuery ? includes.push(`, row_to_json(${get}, true) AS "${asProp}"`) : includes.push(`, row_to_json(${subs}, true) AS "${asProp}"`);
                options['group'].push(`"${alias}".*`);
            }
            else if (returnType == 'array') {
                !needSubQuery ? includes.push(`, json_agg(${get}) AS "${asProp}"`) : includes.push(`, json_agg(${subs}) AS "${asProp}"`);
                //options['group'].push(`"${alias}".*`);
            }
        }
        //console.log('get', get);
        // arr['option'].push("LEFT OUTER JOIN");
        for (let key in obj) {
            if (obj.hasOwnProperty(key) && key == "join") {
                // console.log("from obj[key]", obj[key]);
                // arr['type'].push(this.getJoinType(key));
                /*
                let joinOn: Array<Object> = obj[key]['on'];
                let joinOnClause: string = '';
                let joinAlias: string = `_${obj[key].table.toLowerCase()}`;

                if (joinOn != null) {
                    joinOnClause = this.prepareOnClause(joinOn);
                    if (obj[key].foreignKey) {
                        joinOnClause = `"${alias}"."id"="${joinAlias}"."${obj[key].foreignKey}" AND ` + joinOnClause;
                    }
                } else {
                    joinOnClause = `"${alias}"."id"="${joinAlias}"."${obj[key].foreignKey}"`;
                }

                let joinQuery = `${obj[key].joinType} "${obj[key].table}" as "${joinAlias}" ON (${joinOnClause.length > 0 ? joinOnClause : ''})`;

                console.log('form llooooop....', options['query']);
                query = `(${query} ${joinQuery})`;
                options['query'].push(query);
                console.log('after transforem', options['query']);
                */
                options['joinType'].push(obj[key].joinType);
                this.prepareJoin(alias, obj[key], options, includes);
            }
            else {
            }
        }
        ;
        //console.log("options['query'].length", options['query'].length,  " count: ", count);
        //if (count > options['query'].length) { // looped and inserted a query
        // } else {
        // console.log('insertting------>',`${joinType} "${table}" as "${alias}" ON (${onClause.length > 0 ? onClause : ''} )`);
        // options['query'].push(`${joinType} "${table}" as "${alias}" ON (${onClause.length > 0 ? onClause : ''} )`);
        // }
        //console.log('index', count);
        //console.log('test', options['query']);
        //arr['joinType'] = joinType;
        // console.log('arr', arr);
        //console.log('arr.joinType', options['joinType']);
        // let query = arr.join(' LEFT OUTER JOIN ');
        // let include = inc.join(' ');
        return {
            options: options,
            includes: includes
        };
    }
    convertToUTCDate(date) {
        let dateInput = date || null, dateOutput;
        if (dateInput != null) {
            dateOutput = dateInput.slice(0, dateInput.indexOf('T'));
        }
        return dateOutput;
    }
}
exports.MSSQLWrapper = MSSQLWrapper;
