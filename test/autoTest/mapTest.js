/**
 * @file mapTest.js
 * @author dengxiaohong01
 */

define('mapTest/mod1', ['require'], function (require) {
    return {
        name: 'mod1',
        getTeName: function () {
            return require('te').name; // 等价于 require('mapstar');
        }
    };
});


define('mapTest/mod2', ['require'], function (require) {
    return {
        name: 'mod2',
        getTeName: function () {
            return require('te').name; // 等价于 require('mapstar');
        }
    };
});

define('mapTest/mod3', ['require'], function (require) {
    return {
        name: 'mod3',
        getTeName: function () {
            return require('te').name; // 等价于 require('map');
        }
    };
});

define('mapTest/map', [], function () {
    return {
        name: 'map'
    };
});

define('mapTest/mapstar', [], function () {
    return {
        name: 'mapstar'
    };
});

function mapTest(li) {
    require(
        [
            'mapTest/mod1',
            'mapTest/mod2',
            'mapTest/mod3'
        ],
        function (m1, m2, m3) {
            if (m1.getTeName() === 'mapstar'
                && m2.getTeName() === 'mapstar'
                && m3.getTeName() === 'map') {
                    li.className = 'pass';
            }
            else {
                li.className = 'fail';
            }
        }
    );
}