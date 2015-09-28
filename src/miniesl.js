/**
 *
 * @file 加载器，符合AMD规范
 * config 只支持map、plugin、config
 * @author dxh
 */

var define;
var require;

(function (global) {
    var mods = {};

    var config = {
        config: {},
        map: {}
    };

    /**
     * 定义模块
     *
     * @param {string} id 模块标识
     * @param {Array.<string>} deps 显式声明的依赖模块列表
     * @param {*} factory 模块定义函数或模块对象
     */
    define = function (id, deps, factory) {
        if (typeof id !== 'string') {
            throw new Error('incorrect module build, no module name');
        }
        if (!deps.splice) {
            factory = deps;
            deps = [];
        }

        if (!mods[id]) {
            mods[id] = {
                id: id,
                deps: deps,
                factory: factory,
                defined: 0,
                exports: {},
                config: moduleConfigGetter,
                require: createRequire(id)
            };
        }
    };

    define.amd = {};

    /**
     * 创建local require函数
     *
     * @param {number} baseId 当前module id
     * @return {Function} local require函数
     */
    function createRequire(baseId) {
        var cacheMods = {};

        function localRequire(id, callback) {
            if (typeof id === 'string') {
                var exports = cacheMods[id];
                if (!exports) {
                    var topLevelId = normalize(id, baseId);
                    exports = getModExports(topLevelId, baseId);
                    cacheMods[id] = exports;
                }
                return exports;
            }
            else if (id instanceof Array) {
                callback = callback || function () {};
                callback.apply(this, getModsExports(id, callback, baseId));
            }
        }

        return localRequire;
    }

    /**
     * id normalize化
     *
     * @param {string} id 需要normalize的模块标识
     * @param {string} baseId 当前环境的模块标识
     * @return {string} normalize结果
     */
    function normalize(id, baseId) {
        if (!id) {
            return '';
        }

        baseId = baseId || '';
        var idInfo = parseId(id);

        if (!idInfo) {
            return id;
        }

        var resourceId = idInfo.res;

        // 将相对路径调整为绝对路径
        var moduleId = relative2absolute(idInfo.mod, baseId);

        // 根据config中的map配置进行module id mapping
        moduleId = mappingModuleId(moduleId, baseId);

        // 如果有plugin!resource的话，对resource进行normalize
        if (resourceId) {
            var mod = require(moduleId);
            // 有自定义的normalize用自定义的
            resourceId = mod && mod.normalize
                ? mod.normalize(
                    resourceId,
                    function (resId) {
                        return normalize(resId, baseId);
                    }
                  )
                : normalize(resourceId, baseId);

            moduleId += '!' + resourceId;
        }

        return moduleId;
    }

    /**
     * 解析id，返回带有module和resource属性的Object
     *
     * @inner
     * @param {string} id 标识
     * @return {Object} id解析结果对象
     */
    function parseId(id) {
        var segs = id.split('!');

        if (segs[0]) {
            return {
                mod: segs[0],
                res: segs[1]
            };
        }
    }

    /**
     * 相对id转换成绝对id
     *
     * @inner
     * @param {string} id 要转换的相对id
     * @param {string} baseId 当前所在环境id
     * @return {string} 绝对id
     */
    function relative2absolute(id, baseId) {
        if (id.indexOf('.') === 0) {
            var basePath = baseId.split('/');
            var namePath = id.split('/');
            var baseLen = basePath.length - 1;
            var nameLen = namePath.length;
            var cutBaseTerms = 0;
            var cutNameTerms = 0;

            /* eslint-disable block-scoped-var */
            pathLoop: for (var i = 0; i < nameLen; i++) {
                switch (namePath[i]) {
                    case '..':
                        if (cutBaseTerms < baseLen) {
                            cutBaseTerms++;
                            cutNameTerms++;
                        }
                        else {
                            break pathLoop;
                        }
                        break;
                    case '.':
                        cutNameTerms++;
                        break;
                    default:
                        break pathLoop;
                }
            }
            /* eslint-enable block-scoped-var */

            basePath.length = baseLen - cutBaseTerms;
            namePath = namePath.slice(cutNameTerms);

            return basePath.concat(namePath).join('/');
        }

        return id;
    }

    /**
     * 根据config中的map配置进行module id mapping
     *
     * @inner
     * @param {string} moduleId 要mapping的moduleId
     * @param {string} baseId 当前所在环境id
     * @return {string} mapped moduleId
     */
    function mappingModuleId(moduleId, baseId) {
        var idParts;
        var idSegment;
        var mapValue;
        var foundMap;
        var foundI;
        var foundStarMap;
        var starI;
        var baseParts = baseId && baseId.split('/');
        var map = config.map;
        var starMap = (map && map['*']) || {};

        if ((baseParts || starMap) && map) {
            // 将转换为绝对moduleId的moduleId区分开
            idParts = moduleId.split('/');

            for (var i = idParts.length; i > 0; i--) {
                // 一段一段的分割
                idSegment = idParts.slice(0, i).join('/');

                if (baseParts) {
                    // 从最长到最短baseID查看是否有对应的map
                    for (var j = baseParts.length; j > 0; j--) {
                        mapValue = map[baseParts.slice(0, j).join('/')];
                        if (mapValue) {
                            mapValue = mapValue[idSegment];
                            if (mapValue) {
                                // 如果匹配到了，map到新的值.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                // 查看是否有*类型的map，并且有对应的值,
                if (!foundStarMap && starMap && starMap[idSegment]) {
                    foundStarMap = starMap[idSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                idParts.splice(0, foundI, foundMap);
                moduleId = idParts.join('/');
            }
        }

        return moduleId;
    }

    require = createRequire('');

    /**
     * 配置require
     *
     * @param {Object} conf 配置对象
     */
    require.config = function (conf) {
        if (conf) {
            for (var key in config) {
                if (config.hasOwnProperty(key)) {
                    var newValue = conf[key];
                    // 除了map 和config外都是基本类型, 而map 和config在默认的时候无值
                    if (!newValue) {
                        continue;
                    }
                    else {
                        config[key] = newValue;
                    }
                }
            }
        }
    };

    /**
     * 模块配置获取函数
     *
     * @return {Object} 模块配置对象
     */
    function moduleConfigGetter() {
        var conf = config.config[this.id];
        if (conf && typeof conf === 'object') {
            return conf;
        }
        return {};
    }

    /**
     * 执行模块factory函数，进行模块初始化
     *
     * @param {string} id 模块id
     * @param {string} baseId 当前环境的id
     * @return {*} 模块接口
     */
    function getModExports(id, baseId) {
        // 加载plugin插件
        if (id.indexOf('!') > 0) {
            return loadResource(id, baseId);
        }

        // 正常插件
        var mod = mods[id];
        if (!mod) {
            throw new Error('No ' + id);
        }

        if (!mod.defined) {
            var factory = mod.factory;
            var factoryReturn;
            if (typeof mod.factory === 'object') {
                factoryReturn = mod.factory;
            }
            else {
                factoryReturn = factory.apply(
                    this,
                    getModsExports(mod.deps, factory, id)
                );
            }
            if (typeof factoryReturn !== 'undefined') {
                mod.exports = factoryReturn;
            }
            mod.defined = 1;
        }

        return mod.exports;
    }

    /**
     * 执行模块factory函数，进行模块初始化
     *
     * @param {Array} ids 依赖模块组标识
     * @param {*} factory 模块定义函数或模块对象
     * @param {string} baseId 当前所在环境id
     *
     * @return {*} 模块接口
     */
    function getModsExports(ids, factory, baseId) {
        var es = [];
        var mod = mods[baseId];
        // invoke deps which need
        for (var i = 0, l = Math.min(ids.length, factory.length); i < l; i++) {
            var id = normalize(ids[i], baseId);
            var arg;
            switch (id) {
                case 'require':
                    arg = (mod && mod.require) || require;
                    break;
                case 'exports':
                    arg = mod.exports;
                    break;
                case 'module':
                    arg = mod;
                    break;
                default:
                    arg = getModExports(id, baseId);
            }

            es.push(arg);
        }

        return es;
    }

    /**
     * 加载资源
     *
     * @inner
     * @param {string} pluginAndResource 插件与资源标识
     * @param {string} baseId 当前环境的模块标识
     * @return {*} 模块接口
     */
    function loadResource(pluginAndResource, baseId) {
        // 加载插件资源
        var idInfo = parseId(pluginAndResource);
        var resourceId = idInfo.res;
        var resource = {};
        if (resourceId) {
            resource.id = pluginAndResource;
            var plugin = require(idInfo.mod);
            load(plugin);
            return resource.exports || true;
        }

        /**
         * 加载插件资源
         *
         * @param {Object} plugin 用于加载资源的插件模块
         */
        function load(plugin) {
            var pluginRequire = baseId
                ? mods[baseId].require
                : require;
            plugin.load(
                idInfo.res,
                pluginRequire,
                pluginOnload,
                moduleConfigGetter.call({id: pluginAndResource})
            );
        }

        /**
         * plugin加载完成的回调函数
         *
         * @param {*} value resource的值
         */
        function pluginOnload(value) {
            resource.exports = value || true;
        }
    }

})(this);
