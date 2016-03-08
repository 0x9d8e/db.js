/* 
 * The MIT License
 *
 * Copyright 2015 Ivan Ignatev 
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * 0x9d8e@gmail.com
 */

function Db() {
    this.tables = Db.tables;

    var _all = false,
            _any = false,
            _type = false,
            _table = undefined,
            _orderField = false,
            _orderTarget = false;

    this.select_from = function (table) {
        _table = table;
        return this;
    };

    /**
     * Выборка по полю type
     * @param {string} type
     * @returns {core.m.db}
     */
    this.where_type = function (type) {
        _type = type;
        return this;
    };
    /**
     * Из всей таблицы (или выборки после any) удаляет всё, что хоть как-то не подходит
     * @param {type} filter
     * @returns {core.m.db}
     */
    this.all = function (filter) {
        _all = filter;
        return this;
    };
    /**
     * Выбирает всё, что хоть как-нибудь подходит
     * @param {type} filter
     * @returns {core.m.db}
     */
    this.any = function (filter) {
        _any = filter;
        return this;
    };
    /**
     * 
     * @param {string} field
     * @param {string} target
     * @returns {core.m.db}
     */
    this.order_by = function (field, target) {
        if (field)
            _orderField = field;
        else
            _orderField = false;

        if (target)
            _orderTarget = target;
        else
            _orderTarget = 'ASC';

        return this;
    };



    /**
     * Полагаю нужно будет всё это отрефакторить и оптимизировать.
     * Если в таблице есть индекс для данного поля, то ищет по нему, иначе, если это id, то ищет в данных по нему, иначе ищет в данных по значениям.
     * Индексы нужны при поиске по большим таблицам.
     * Нужно хорошенько измерить производительность в т.ч. с большим числом записей, 
     * с индексами и без.
     * @returns {object|Array}
     */
    this.execute = function (withKeys, advancedKeys) {
        if (!withKeys)
            var withKeys = false;
        if (!advancedKeys)
            var advancedKeys = false;
        var tmpSelection = {};
        if (typeof (_table) === 'string')
            var table = this.tables[_table];
        else
            var table = _table;//Таким образом вместо таблицы можно передавать объект/массив/результат запроса

        if (typeof _any === 'object') {
            var filter = _any;
            for (var key in filter) {
                tmpSelection = this._incluse(key, filter[key], table, tmpSelection);
            }
        } else
            for (var key in table.data)
                tmpSelection[key] = true;

        if (typeof _all === 'object') {
            var filter = _all;
            for (var key in filter) {
                tmpSelection = this._excluse(key, filter[key], table, tmpSelection);
            }
        }

        //Печаль, что приходится фильтровать типы в конце :(
        if (_type) {
            tmpSelection = this._excluse('type', _type, table, tmpSelection);
        }


        var array = [];

        for (var key in tmpSelection)
            array.push(table.data[key]);


        //Сортировка
        if (_orderField) {
            var sorter = function (a, b) {
                if (a[_orderField] < b[_orderField]) {
                    return -1;
                } else if (a[_orderField] > b[_orderField]) {
                    return 1;
                }
                return 0;
            }.bind({_orderField: _orderField});
            array.sort(sorter);

            if (_orderTarget === 'DESC')
                array.reverse();

        }

        //WARNING! После введения сортировки эти поля стали некорректны. Нужно их исправить.
        if (advancedKeys)
            console.warn('DB.advansedKeys некорректны, не стоит их использовать');
        //Устанавливаем вспомогательные поля
        for (var i = array.length - 1; i >= 0; i--) {
            array[i]._selectRowNumber = i;

            if (advancedKeys) {
                array[i]._tableRowNumber = this.indexOfKey(array[i].id, table.data);
            }
        }

        //Если нужно преобразуем к объекту с id в качестве ключей
        if (withKeys) {
            var out = {};
            for (var i = 0; i < array.length; i++) {
                out[array[i].id] = array[i];
            }
            out['length'] = array.length;
            return out;
        } else {
            return array;
        }
    };

    //Возвращает id всех элементов table, имеющих поле key равное полю value
    this._incluse = function (key, filterValue, table, selection) {
        key = key + '';
        var result = selection;

        if (table.indexes !== undefined)
            var index = table.indexes[key];

        if (typeof filterValue !== 'object')
            filterValue = [filterValue + ''];

        if (index !== undefined) { //Выбираем pk из индекса
            for (var i = filterValue.length - 1; i >= 0; i--) {
                var indexValues = index[filterValue[i]];
                for (var ii = indexValues.length - 1; ii >= 0; ii--)
                    result[indexValues[ii]] = true;
            }
        } else if (key === 'id') { //Значения фильтра и есть pk?
            for (var i = filterValue.length - 1; i >= 0; i--) {
                if (table.data[filterValue[i] + ''] !== undefined) //Ceществует? Помещаем в выборку
                    result[filterValue[i] + ''] = true;
            }
        } else { //Ищем без индекса, по значениям 
            for (var pk in table.data) {
                var item = table.data[pk];
                if (item[key] !== undefined) //В записи есть значение с таким ключём?
                    if (typeof (item[key]) === 'object') { //Массив?
                        var values = item[key];
                        for (var i = values.length - 1; i >= 0; i--) {
                            if (filterValue.indexOf(values[i] + '') > -1) {//Есть ли это значение в фильтре?
                                result[pk] = true;
                                break;
                            }
                        }
                    } else if (filterValue.indexOf(item[key] + '') > -1) {//Есть ли это значение в фильтре?
                        result[pk] = true;
                    }
            }
        }
        return result;
    };
    //Удаляет из selection все элементы, не имеющие в таблице поля key равного полю value и возвращает оставшееся
    this._excluse = function (key, filterValue, table, selection) {
        key = key + '';

        if (table.indexes !== undefined)
            var index = table.indexes[key];

        if (typeof filterValue !== 'object')
            filterValue = [filterValue + ''];

        if (index !== undefined) {//Выбираем pk из индекса
            for (var i = filterValue.length - 1; i >= 0; i--) {
                var indexValues = index[filterValue[i]];
                if (indexValues === undefined) { //Нет индекса для значения фильта? Ариведерчи!
                    selection = [];
                    break;
                }
                for (var ii in selection) {
                    if (indexValues.indexOf(ii) === -1)
                        delete selection[ii];
                }
            }
        } else if (key === 'id') {//Значения фильтра и есть pk?
            for (var pk in selection) {//Веребираем все ключи имеющейся выборки
                if (filterValue.indexOf(pk + '') === -1) //В фильтрке такого нет? Исключаем запись
                    delete selection[pk];
            }
        } else { //Ищем без индекса, по значению
            for (var pk in selection) {
                var item = table.data[pk];
                if (item[key] === undefined || filterValue.indexOf(item[key] + '') === -1) {
                    delete selection[pk];//Если запись не имеет такого ключа 
                    continue;               //или его значения нет в фильте, то исключаем её
                }
            }
        }
        return selection;
    };
    
    /**
     * Рекурсивно клонирует объект
     * @param object object
     * @returns object
     */
    this.clone = function (object) {
        var out = {};
        for (var key in object) {
            var value = object[key];
            if (typeof value === 'object') {
                out[key] = this.clone(object[key]);
            } else
                out[key] = value;
        }
        return out;
    };
    /**
     * Порядковый номер ключа в объекте
     * @param {string} needle
     * @param {object} haystack
     * @returns {Number}
     */
    this.indexOfKey = function (needle, haystack) {
        var index = 0;
        for (var key in haystack) {
            if (key === needle) {
                return index;
            }
            index++;
        }
        return -1;
    };

    Object.defineProperty(this, 'where', {
        enumerable: true,
        get: function () {
            return this;
        }
    });
}


