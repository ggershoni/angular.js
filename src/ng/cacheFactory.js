'use strict';

/**
 * @ngdoc service
 * @name $cacheFactory
 *
 * @description
 * Factory that constructs cache objects and gives access to them.
 *
 * ```js
 *
 *  var cache = $cacheFactory('cacheId');
 *  expect($cacheFactory.get('cacheId')).toBe(cache);
 *  expect($cacheFactory.get('noSuchCacheId')).not.toBeDefined();
 *
 *  cache.put("key", "value");
 *  cache.put("another key", "another value");
 *
 *  // We've specified no options on creation
 *  expect(cache.info()).toEqual({id: 'cacheId', size: 2});
 *
 * ```
 *
 *
 * @param {string} cacheId Name or id of the newly created cache.
 * @param {object=} options Options object that specifies the cache behavior. Properties:
 *
 *   - `{number=}` `capacity` — turns the cache into LRU cache.
 *
 * @returns {object} Newly created cache object with the following set of methods:
 *
 * - `{object}` `info()` — Returns id, size, and options of cache.
 * - `{{*}}` `put({string} key, {*} value)` — Puts a new key-value pair into the cache and returns
 *   it.
 * - `{{*}}` `get({string} key)` — Returns cached value for `key` or undefined for cache miss.
 * - `{void}` `remove({string} key)` — Removes a key-value pair from the cache.
 * - `{void}` `removeAll()` — Removes all cached values.
 * - `{void}` `destroy()` — Removes references to this cache from $cacheFactory.
 *
 * @example
   <example module="cacheExampleApp">
     <file name="index.html">
       <div ng-controller="CacheController">
         <input ng-model="newCacheKey" placeholder="Key">
         <input ng-model="newCacheValue" placeholder="Value">
         <button ng-click="put(newCacheKey, newCacheValue)">Cache</button>

         <p ng-if="keys.length">Cached Values</p>
         <div ng-repeat="key in keys">
           <span ng-bind="key"></span>
           <span>: </span>
           <b ng-bind="cache.get(key)"></b>
         </div>

         <p>Cache Info</p>
         <div ng-repeat="(key, value) in cache.info()">
           <span ng-bind="key"></span>
           <span>: </span>
           <b ng-bind="value"></b>
         </div>
       </div>
     </file>
     <file name="script.js">
       angular.module('cacheExampleApp', []).
         controller('CacheController', ['$scope', '$cacheFactory', function($scope, $cacheFactory) {
           $scope.keys = [];
           $scope.cache = $cacheFactory('cacheId');
           $scope.put = function(key, value) {
             $scope.cache.put(key, value);
             $scope.keys.push(key);
           };
         }]);
     </file>
     <file name="style.css">
       p {
         margin: 10px 0 3px;
       }
     </file>
   </example>
 */
function $CacheFactoryProvider() {

  this.$get = function() {
    var caches = {};

    function cacheFactory(cacheId, options) {
      if (cacheId in caches) {
        throw minErr('$cacheFactory')('iid', "CacheId '{0}' is already taken!", cacheId);
      }

      var size = 0,
          stats = extend({}, options, {id: cacheId}),
          data = {},
          capacity = (options && options.capacity) || Number.MAX_VALUE,
          lruHash = {},
          freshEnd = null,
          staleEnd = null;

      return caches[cacheId] = {

        put: function(key, value) {
          if (capacity < Number.MAX_VALUE) {
            var lruEntry = lruHash[key] || (lruHash[key] = {key: key});

            refresh(lruEntry);
          }

          if (isUndefined(value)) return;
          if (!(key in data)) size++;
          data[key] = value;

          if (size > capacity) {
            this.remove(staleEnd.key);
          }

          return value;
        },


        get: function(key) {
          if (capacity < Number.MAX_VALUE) {
            var lruEntry = lruHash[key];

            if (!lruEntry) return;

            refresh(lruEntry);
          }

          return data[key];
        },


        remove: function(key) {
          if (capacity < Number.MAX_VALUE) {
            var lruEntry = lruHash[key];

            if (!lruEntry) return;

            if (lruEntry == freshEnd) freshEnd = lruEntry.p;
            if (lruEntry == staleEnd) staleEnd = lruEntry.n;
            link(lruEntry.n,lruEntry.p);

            delete lruHash[key];
          }

          delete data[key];
          size--;
        },


        removeAll: function() {
          data = {};
          size = 0;
          lruHash = {};
          freshEnd = staleEnd = null;
        },


        destroy: function() {
          data = null;
          stats = null;
          lruHash = null;
          delete caches[cacheId];
        },


        info: function() {
          return extend({}, stats, {size: size});
        }
      };


      /**
       * makes the `entry` the freshEnd of the LRU linked list
       */
      function refresh(entry) {
        if (entry != freshEnd) {
          if (!staleEnd) {
            staleEnd = entry;
          } else if (staleEnd == entry) {
            staleEnd = entry.n;
          }

          link(entry.n, entry.p);
          link(entry, freshEnd);
          freshEnd = entry;
          freshEnd.n = null;
        }
      }


      /**
       * bidirectionally links two entries of the LRU linked list
       */
      function link(nextEntry, prevEntry) {
        if (nextEntry != prevEntry) {
          if (nextEntry) nextEntry.p = prevEntry; //p stands for previous, 'prev' didn't minify
          if (prevEntry) prevEntry.n = nextEntry; //n stands for next, 'next' didn't minify
        }
      }
    }


  /**
   * @ngdoc method
   * @name $cacheFactory#info
   *
   * @description
   * Get information about all the of the caches that have been created
   *
   * @returns {Object} - key-value map of `cacheId` to the result of calling `cache#info`
   */
    cacheFactory.info = function() {
      var info = {};
      forEach(caches, function(cache, cacheId) {
        info[cacheId] = cache.info();
      });
      return info;
    };


  /**
   * @ngdoc method
   * @name $cacheFactory#get
   *
   * @description
   * Get access to a cache object by the `cacheId` used when it was created.
   *
   * @param {string} cacheId Name or id of a cache to access.
   * @returns {object} Cache object identified by the cacheId or undefined if no such cache.
   */
    cacheFactory.get = function(cacheId) {
      return caches[cacheId];
    };


    return cacheFactory;
  };
}

/**
 * @ngdoc service
 * @name $templateCache
 *
 * @description
 * The first time a template is used, it is loaded in the template cache for quick retrieval. You
 * can load templates directly into the cache in a `script` tag, or by consuming the
 * `$templateCache` service directly.
 *
 * Adding via the `script` tag:
 *
 * ```html
 *   <script type="text/ng-template" id="templateId.html">
 *     <p>This is the content of the template</p>
 *   </script>
 * ```
 *
 * **Note:** the `script` tag containing the template does not need to be included in the `head` of
 * the document, but it must be below the `ng-app` definition.
 *
 * Adding via the $templateCache service:
 *
 * ```js
 * var myApp = angular.module('myApp', []);
 * myApp.run(function($templateCache) {
 *   $templateCache.put('templateId.html', 'This is the content of the template');
 * });
 * ```
 *
 * To retrieve the template later, simply use it in your HTML:
 * ```html
 * <div ng-include=" 'templateId.html' "></div>
 * ```
 *
 * or get it via Javascript:
 * ```js
 * $templateCache.get('templateId.html')
 * ```
 *
 * See {@link ng.$cacheFactory $cacheFactory}.
 *
 */
function $TemplateCacheProvider() {
  this.$get = ['$cacheFactory', function($cacheFactory) {
    return $cacheFactory('templates');
  }];
}

