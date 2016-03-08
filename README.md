# db.js
Javascript fluent database (select only)

## Зачем
* Избавляемся от множества циклов с выбором подходящего объекта в объекте/массиве;
* Сокращаем запросы к серверу;
* Рационально переиспользуем имеющиеся/ранее полученные данные.

Например в одном магазине при добавлении товара в корзину мне нужно было:
*  Проверить есть ли в корзине такой тавар;
*  Если нет, то добавить, если есть, то увеличить его колличество;
*  Расчитать для товара сумму с учётом опций и количества;
*  Расчитать общую сумму для всех товаров;
*  Пересчитать общую сумму второстепенных параметров (вес и т.п.);
*  Отразить все эти изменения в интерфейсе;
*  Отправить новое состояние корзины на сервер (список с id, amount и дополнительными параметрами);

Разумеется для всего этого требуется много информации о каждом товаре (catalog_good) и о том, что уже имеется в корзине (cart_item). Разумеется хранить все товары на клиенте очень нерационально, поэтому было сделано вот, что. При первоначальной загрузке в таблице catalog_good были объекты всех товаров, которе неспосредственно отображены на странице. При добавлении товара в корзину у объекта в таблице устанавливался параметр, запрещающий его удалять, а при удалении удалялся. При любой асинхронной подгрузке товаров, будь то по клику на "Показать ещё", при сортировке, фильтрации, переходам по категориям и т.п. мы так или иначе получали от сервера объекты товаров и тут-же добавляли их в соответствующую таблицу, а объекты товаров, которые больше не отображаются и не запрещены к удалению (т.е. не висят в корзине) из таблицы удалялись. В итоге всегда под рукой были все необходимые данные, но небыло никаких лишних. Возможно это звучит сложно, но на деле было элементарно.

Прекрасно и совершенно моментально работает фильтрация не слишком больших объёмов данных. Так, например, на одном сайте вся фильтрация полностью осуществлялась db.js, при этом перестраивались меню, а также спики материалов с кратким описанием и превью. Полные же версии материалов в db.js не хранились и загружались с сервера по клику "Показать полностью". 
Есть и другие успешные примеры. Во всех случаях использование db.js помогло достичь максимальной отзывчивости интерфейса (чаще всего вообще не нужно ждать ответов сервера), при этом максимально отделяя модели от интерфейса (скажем теперь не требуется хранить кучу параметров о товаре в data-аттрибутах его кнопки "Добавить в корзину"). 


## Как

Db.js озволяет делать выборки по заранее заданным или переданным объектам. То есть можно заранее задать набор таблиц: 
Db.tables = {first_example_table:{}, second_example_table:{}};

И затем использовать их по имени:
var objects = (new Db()).select_from('first_example_table').where_type('example_type').all({some_param: 20}).execute();

Либо можно непосредственно передать таблицу в select_from:
var objects = (new Db()).select_from({1:{id: 1, type:'bad', some_param: 20}, 2:{id:2, type:'good', some_param:20}, 3:{id: 3, type:'good', some_param:30}}).where_type('good').all({some_param: 20}).execute(); //Получим [{id:2, type:'good', some_param:20}]

Методы all и any работают следующим образом:
Оба метода принимают на вход объект вида {key: value} (число ключей и значений не ограничено). Метод any (внутренний метод _incluse) добавляет из таблицы в выборку всё, что хоть в одном параметре соответствует переданному объекту. Метод all (внутренний _excluse) выбирает только то, что полностью соответствует параметрам переданного объекта (или удаляет из выборки всё, что хоть чем-либо не подходит). От последовательности вызова методов результат не зависит.

Какие-либо методы сравнения кроме == отвутствуют за ненадобностью и тяжеловесностью. Раземеется, если вдруг понадобится, можно добавить. Но я бы не рекомендовал т.к. db.js не предназначена для полной замены sql и, возможно, вам нужно что-то другое.

Сама выборка осуществляется вызовом метода execute(withKeys = false) с необязательным параметром withKeys. Если withKeys не задан или false, выборка возвращается в виде массива [object, object], если же withKeys задан в true, то execute вернёт объект вида {id:object, id:object}.
В последнем случае результат можно использовать в качестве таблицы для других запросов.

##Примеры

var colors = {
  red: 'красный',
  yellow: 'желтый'
  
}, fruits = {
  10: {
    id:10,
    alias:'apple',
    name:'Яблоко',
    price:30,
    color:'red'
  },
  16: {
    id:16,
    alias:'banana',
    name:'Банан',
    price:42,
    color:'yellow'
  },
  22: {
    id:22,
    alias:'lemon',
    name:'Лимон',
    price:25,
    color:'yellow'
  }
};

var yellow_fruits = getFruitsByColor('yellow');// [{id:16, alias:'banana', name:'Банан', price:42, color:'желтый'},{{id:22, alias:'lemon', name:'Лимон', price:25, color:'желтый'}}]

function getFruitsByColor(color) {
  var fruits = (new Db()).select_from(fruits).all({color: color}).execute();
  fruits.each(function(item) {
    item = new Fruit(item);
  });
  return fruits;
}

function Fruit(fruit) {
  for(var key in fruit) {
    this[key] = fruit;
  }
  this.color = colors[this.color];
}



