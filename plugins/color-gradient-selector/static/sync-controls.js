$(function() {

    /*
     * this script synchronizes the gradient selector controls
     * with the chart.
     *
     * the gradient selector supports both classified gradients
     * with a distinct number of color classes and full range
     * gradients that are defined only by a min/max and a center
     * value...q
     */

    var backendEvents = dw.backend;

    dw.backend.on('sync-option:color-gradient-selector', function(args) {

        var key = args.key,
            chart = args.chart,
            rt = $('#vis-options-'+key),
            key_prefix = 'metadata.visualize.' + key,
            use_classes = args.option['use-classes'],
            // getting the right column via vis.axes() and color-axis (defined in meta)
            column = args.vis.axes(true)[args.option['color-axis']],
            // UI Elements
            uis = getUIElements(),
            // Storage keys and default values
            storage = getStorage(),
            // timer
            _updateUI;

        initializeDefaultValues();

        // initialize preset HTML from theme gradients
        backendEvents
            .on('theme-loaded', initGradientPresets)
            .on('theme-loaded', initColorSelectors)
            .on('vis-msg-init', visRendered);

        function visRendered() {
            initGradientPresets();
            initColorSelectors();
            serialize_colors();
            initialize_fields();
        }

        initializeUIControls();

        // Initialize fields from saved settings
        initialize_fields();

        // -------------------------------------------------
        // only function definitions allowed below this line
        // -------------------------------------------------

        function getUIElements() {
            return {
                colors: $('.control-label.color span' , rt),
                //
                diverging_color: $('.diverging-color' , rt),
                // gradient
                gradient_presets: $('.presets li' , rt),
                bookmark: $('.btn.bookmark', rt),

                // value range, if use_classes == false
                minimum: $('input.minimum' , rt),
                center: $('input.center' , rt),
                maximum: $('input.maximum' , rt),
                color_range_reset: $('.color-range-reset', rt),

                // classification, if use_classes == true
                classes_number: $('.classes-count', rt),
                class_limit_mode: $('select[name=class-limit-mode]', rt),
                custom_limits: $('.custom-limits', rt),
                custom_limits_reset: $('.custom-limits-reset', rt),
            };
        }

        function getStorage() {
            return {
                classes_number : { key: key_prefix+'.classes-number', default: 5},
                class_limit_mode : { key: key_prefix+'.class-limit-mode', default: 'equidistant'},
                chromajs_constructor : { key: key_prefix+'.chromajs-constructor', default: null},
                domain : { key: key_prefix+'.domain', default: column.range() },
                colors : { key: key_prefix+'.colors', default: null },
                range_min : { key: key_prefix+'.range.min', default: column.range()[0] },
                range_max : { key: key_prefix+'.range.max', default: column.range()[1] },
                range_center : { key: key_prefix+'.range.center', default: null },
                custom_limits: { key: key_prefix+'.custom-limits', default: [] }
            };
        }

        function initializeDefaultValues() {
            // Initialize default values
            _.each(storage, function(key_and_default) {
                if (key_and_default["default"] !== null && chart.get(key_and_default.key) === undefined) {
                    chart.set(key_and_default.key, key_and_default["default"]);
                }
            });
        }


        function initializeUIControls() {

            $('.color-count', rt).numberstepper({
                value: chart.get(storage.colors.key, []).length,
                changed: colorCountChanged
            });

            if (!supports_html5_storage()) {
                uis.bookmark.prop('disabled', true);
            } else {
                uis.bookmark.click(store_current_as_bookmark);
            }

            // show full gradient controls on button click
            $('.customize-gradient a', rt).off('click').click(function(e) {
                e.preventDefault();
                $('.customize-gradient').hide();
                $('.edit-gradient').removeClass('hide-smart');
            });

            $('.btn.reverse-colors', rt).off('click').click(function(e) {
                e.preventDefault();
                var colors = chart.get(storage.colors.key);
                if (colors) {
                    chart.set(storage.colors.key, colors.slice(0).reverse());
                    updateUI();
                }
            });

            // init classes or min/max7center
            if (use_classes) {
                $('.range', rt).remove();
                uis.classes_number.numberstepper({
                    value: chart.get(storage.classes_number.key),
                    changed: classNumberChanged
                });
                uis.class_limit_mode.change(classLimitModeChanged);
                toggleCustomLimitsUI();
            } else {
                $('.classification', rt).remove(); // hide classification controls
                uis.color_range_reset.click(resetRange);
                // synchronize min/max/center values
                syncValue(uis.minimum, storage.range_min.key);
                syncValue(uis.center, storage.range_center.key);
                syncValue(uis.maximum, storage.range_max.key);
            }

            function colorCountChanged(val) {
                var old_colors = chart.get(storage.colors.key),
                    old_grad = chroma.scale(old_colors).mode('lab'),
                    new_colors = [],
                    diverging = val % 2 == 1,
                    center = '#f6f6f6';

                if (!old_colors) return;

                for (var i=0; i < val; i++) {
                    new_colors.push(old_grad(i/(val-1)).name());
                }
                chart.set(storage.colors.key, new_colors);
                updateUI();
            }

            function classNumberChanged(val) {
                chart.set(storage.classes_number.key, val);
                // reset custom limits
                chart.set(storage.custom_limits.key, []);
                initCustomClassLimits();
                updateUI();
            }

            function classLimitModeChanged() {
                chart.set(storage.class_limit_mode.key, uis.class_limit_mode.val());
                toggleCustomLimitsUI();
                updateUI();
            }

            /*
             * if use_classes is false, this function
             * resets the min/center/max values
             */
            function resetRange() {
                var range = column.range();
                uis.minimum.val(range[0]);
                uis.center.val('');
                uis.maximum.val(range[1]);
                chart.set(storage.range_min.key, range[0]);
                chart.set(storage.range_max.key, range[1]);
                chart.set(storage.range_center.key, '');
            }


            function syncValue(el, key, allowEmpty){
                el.val(chart.get(key));
                function save() {
                    if (allowEmpty && $.trim(el.val()) === '' || (el.val() && _.isNumber(+el.val()) && !isNaN(+el.val()))) {
                        chart.set(key, el.val());
                        updateUI();
                    }
                }
                el.change(save).keyup(save);
            }
        }

        /**
        * Set the fields's values from the saved settings
        **/
        function initialize_fields() {
            // classes number
            uis.classes_number.numberstepper({ value: chart.get('metadata.visualize.'+key+'.classes-number', 5) });
            if (use_classes) {
                // class limit mode
                uis.class_limit_mode.val(chart.get('metadata.visualize.'+key+'.class-limit-mode', 'equidistant'));
            }

            // colors
            var range = column.range(),
                colors = chart.get(storage.colors.key);

            if (colors) {
                previewGradient(colors, $('.display', rt), true);

                // update value
                $('.color-count', rt).numberstepper({
                    value: colors.length
                });

                // remove current color stops
                var $gradientEditor = $('.gradient-editor', rt);
                $('.color', $gradientEditor).remove();
                var gw = $gradientEditor.width();
                // add color stops
                _.each(colors, function(color, i) {
                    var div = $('<div />')
                        .addClass('color')
                        .attr('data-color', color)
                        .css('background-color', color)
                        .appendTo($gradientEditor);
                    div.css('left', (gw - div.width()) * i / (colors.length-1));
                });

                initColorSelectors();
                check_bookmark();

                if (!use_classes) {
                    uis.center.prop('disabled', colors.length < 3);
                }
            } else {
                // no colors so far, but we'll set them later from first preset
            }

            if (use_classes) {
                initCustomClassLimits();
            } else {
                uis.color_range_reset.prop('disabled',
                    chart.get(storage.range_min.key) == column.range()[0] &&
                    chart.get(storage.range_max.key) == column.range()[1] &&
                    chart.get(storage.range_center.key, '') === ''
                );
            }
        }

        /*
         * resets and populates the gradient preset select
         * called whenever the theme has changed
         */
        function initGradientPresets() {
            $('.presets', rt).find('li').remove();
            var theme = dw.theme(chart.get('theme')),
                gradients = [].concat(theme.colors.gradients, get_bookmarks());
            _.each(gradients, function(colors) {
                $('<a>')
                    .attr('href', '#')
                    .data('gradient', colors)
                    .appendTo($('<li>').appendTo($('.presets', rt)));
            });
            // If there is no serialized color (needed by visualization), we load the first preset
            if (!chart.get(storage.chromajs_constructor.key) || chart.get(storage.colors.key) === undefined) {
                load_preset(gradients[0]);
            }

            // Colorize presets in selectbox
            $('.presets li', rt).each(function(i, option) {
                option = $(option);
                var colors = option.find('a').data('gradient');
                previewGradient(colors, option.find('a'));
            });
            //  bind events
            $('.presets li a', rt).click(function(e) {
                e.preventDefault();
                var a = $(e.currentTarget);
                load_preset(a.data('gradient'));
                $('.display', rt).html(a.html());
            });
            // show selected gradient
            previewGradient(chart.get(storage.colors.key), $('.display', rt), true);
        }

        /**
         * Save the attributes for the given preset and reload the option fields with the right values.
         * param: comma separated list of hex codes, with either 2 or 3 values
         * `median` is not required.
         **/
        function load_preset(colors) {
            chart.set(storage.colors.key, colors);
            updateUI();
        }


        function L_ordered(colors) {
            var lightness = _.map(colors, function(c) { return chroma(c).lab()[0]; });
            return _.some(lightness, function(l, i) {
                return i > 0 && (lightness[1] > lightness[0] ? l < lightness[i-1] : l > lightness[i-1]);
            }) === false;
        }

        function previewGradient(colors, cont, selected) {
            cont.html('');
            var colsc = chroma.scale(colors).mode('lab'),
                $prev = $('.gradient-preview', rt),
                color_stops = [],
                steps = 20;

            if (L_ordered(colors)) colsc.correctLightness(true);

            _.each(_.range(steps), function(i) {
                var f = i / (steps - 1),
                    w = 120 / steps,
                    x = 5 + w * i;
                $('<div />')
                    .addClass('step')
                    .css({ background: colsc(f).hex() })
                    .appendTo(cont);
                color_stops.push(colsc(f).css()+' '+Math.round(f*100)+'%');
            });
            if (selected) {
                $prev.css('background-image', 'linear-gradient(to right, '+color_stops+')');
            }
        }

        function initColorSelectors() {
            var theme = dw.theme(chart.get('theme')),
                color_uis = $('.gradient-editor .color', rt),
                current_color;
            // show color picker on `uis.colors` click
            if (!theme) return;
            color_uis.click(function(e) {
                current_color = color_uis.index(e.currentTarget);
                $(e.currentTarget).colorselector({
                    color: $(color_uis[current_color]).data('color'),
                    palette: [].concat(theme.colors.palette, theme.colors.secondary, ['#f6f6f6']),
                    change: function(color) {
                        $(color_uis[current_color]).attr('data-color', color).data('color', color);
                        var colors = [];
                        color_uis.each(function(i, el) {
                            colors.push($(el).data('color'));
                        });
                        chart.set(storage.colors.key, colors);
                        updateUI();
                    }
                });
            });
        }

        function is_sequential() {
            return true;
        }

        /** return the middle of the given line */
        function get_median(values) {
            var s = values.slice(0).sort(function(a,b) { return a-b; }),
                l = s.length;
            return l % 2 === 0 ? (s[l/2]+s[l/2-1])*0.5 : s[(l-1)/2];
        }

        /**
        * Saves colors and breaks in a serialized format under the `storage.chromajs_constructor` key.
        * Sould be called after each write access of gradient properties
        **/
        function serialize_colors() {
            var colors = chart.get(storage.colors.key);
            if (!colors) return;
            // check if colors are in a lightness sequence
            var sorted = L_ordered(colors),
                domain = use_classes ? get_breaks() : [],
                constructor = "chroma.scale("+JSON.stringify(colors)+
                    (!use_classes ? ','+JSON.stringify(get_color_positions()) : '')+
                    ").domain(["+domain+"]).mode('lab')"+
                    (sorted && colors.length > 2 ? '.correctLightness(true)' : '')+';';
            chart.set(storage.domain.key, domain);
            chart.set(storage.chromajs_constructor.key, constructor);
        }

        /**
        * Return an array of breaks based on `storage.class_limit_mode` and `storage.classes_number`.
        * This function will call the right calculating function.
        **/
        function get_breaks() {

            var break_type     = chart.get(storage.class_limit_mode.key);
            var number_classes = chart.get(storage.classes_number.key);

            if (use_classes) {

                switch(break_type) {
                    case "equidistant":
                        return equidistant(number_classes, is_sequential() ? undefined : chart.get(storage.median.key));
                    case "equidistant-rounded":
                        return dw.utils.smartRound(equidistant(number_classes, is_sequential() ? undefined : chart.get(storage.median.key)));
                    case "nice":
                        return nice(number_classes, is_sequential() ? undefined : chart.get(storage.median.key));
                    case "quantiles":
                        return _.uniq(quantiles(number_classes));
                    case "custom":
                        return custom();
                }

            } else {
                return [chart.get(storage.range_min.key), chart.get(storage.range_max.key)];
            }

            /*
             * Returns the equidistant breaks for the given center number of classe wanted and the center
             * center can be undefined
             */
            function equidistant(classes, center) {
                var min = column.range()[0] !== null ? column.range()[0] : 0;
                var max = column.range()[1] !== null ? column.range()[1] : 0;
                if (center === undefined) {
                    return f(min, max, classes);
                }
                function f(left, right, cl) {
                    return chroma.limits(
                        chroma.analyze([parseFloat(left), parseFloat(right)]),
                        'e', parseInt(cl, 10)
                    );
                }
                var l = Math.floor(classes/2),
                    m = Math.ceil(classes/2),
                    ls = center < (max - min)*0.5;
                return [].concat(
                    f(min, center, ls ? l : m),
                    f(center, max, ls ? m : l).slice(1)
                );
            }

            /*
             * Returns the nice breaks for the given center number of classe wanted and the center
             * center can be undefined
             */
            function nice(classes, center) {
                function breaks() {
                    if (center == undefined) {
                        return f(column.range()[0], column.range()[1], classes);
                    }
                    function f(left, right, cl) {
                        return d3.scale.linear().domain([left, right]).ticks(cl);
                    }
                    var min = column.range()[0] !== null ? column.range()[0] : 0;
                    var max = column.range()[1] !== null ? column.range()[1] : 0;
                    var left = f(min, center, classes/2),
                        right = f(center, max, classes/2);
                    if (classes % 2 == 0) {
                         if (left.length != classes / 2 || right.length != classes / 2) {
                             return equidistant(classes, center).map(Math.round);
                         }
                    }
                    return [].concat(left, center, right);
                }
                var b = breaks(),
                    maxiter = 10;
                while (b.length < 3 && maxiter-- > 0) {
                    classes++;
                    b = breaks();
                }
                return b;
            }

            function quantiles(classes) {
                var breaks = chroma.limits(chroma.analyze(_.filter(column.values(), _.isNumber)), 'q', classes);
                return breaks;
            }

            function custom() {
                // get fixed
                var fixed = get_fixed_custom_limits(),
                    out = [];
                function f(i) {
                    var prev_i = i-1, next_i = i+1, cl;
                    while (fixed[prev_i] === null) { prev_i--; }
                    while (fixed[next_i] === null) { next_i++; }
                    cl = next_i - prev_i;
                    return fixed[prev_i] + (i-prev_i) * (fixed[next_i] - fixed[prev_i])/cl;
                }
                // and fill in the nulls
                _.each(fixed, function(val, i) {
                    out[i] = val === null ? f(i) : val;
                });
                return out;
            }

        } // end get_breaks()

        function get_color_positions() {
            var center = chart.get(storage.range_center.key, ''),
                colors = chart.get(storage.colors.key),
                k = colors.length;

            if (center === '') return [].concat(_.range(0,1,1/(k-1)),[1]);

            // compute color positions
            var r = [chart.get(storage.range_min.key), chart.get(storage.range_max.key)],
                f = (+center - r[0]) / (r[1] - r[0]);
            if (k == 2) return [0, 1];
            if (k == 3) return [0, f, 1];
            if (k % 2 == 1) { // odd number of colors
                return [].concat(
                    _.range(0, f, f / Math.floor(k/2)),  // left
                    _.range(f, 1, (1-f) / Math.floor(k/2)),  // right
                    [1]
                );
            } else { // even number of colors
                var f0 = f * 0.7,
                    f1 = 1 - (1-f) * 0.7;
                return [].concat(
                    _.range(0, f0, f0 / (k/2-1)),  // left
                    [f0],
                    _.range(f1, 1, (1-f1) / (k/2-1)),  // right
                    [1]
                );
            }
        }

        function store_current_as_bookmark(evt) {
            evt.preventDefault();
            if (!supports_html5_storage()) return false;
            var colors = chart.get(storage.colors.key),
                bookmarks = get_bookmarks();

            if (colors) {
                if (!_.find(bookmarks, function(bc) { return _.isEqual(bc, colors); })) {
                    // gradient is not bookmarked yet
                    bookmarks.push(colors);
                } else {
                    bookmarks = _.filter(bookmarks, function(bc) { return !_.isEqual(bc, colors); });
                }
                localStorage.setItem("color-gradient-selector-bookmarks", JSON.stringify(bookmarks));
            }
            check_bookmark();
            initGradientPresets();  // show bookmark in list
        }

        function get_bookmarks() {
            if (supports_html5_storage()) {
                var bookmarks = localStorage.getItem("color-gradient-selector-bookmarks");
                if (bookmarks) return JSON.parse(bookmarks);
            }
            return [];
        }

        function supports_html5_storage() {
            try {
                return 'localStorage' in window && window['localStorage'] !== null;
            } catch (e) {
                return false;
            }
        }

        function check_bookmark() {
            var colors = chart.get(storage.colors.key),
                bookmarks = get_bookmarks();
            if (colors && _.find(bookmarks, function(bc) { return _.isEqual(bc, colors); })) {
                $('i', uis.bookmark).removeClass('icon-star-empty').addClass('icon-star');
            } else {
                $('i', uis.bookmark).removeClass('icon-star').addClass('icon-star-empty');
            }
        }

        function initCustomClassLimits() {
            var cnt = $('.custom-limits', rt).html(''),
                breaks = get_breaks(),
                fixed = get_fixed_custom_limits(),
                rbreaks = dw.utils.smartRound(breaks, 1),
                h = 22,
                total_w = cnt.width(),
                w = total_w / (breaks.length),
                colsc = eval(chart.get(storage.chromajs_constructor.key)),
                custom_limits = chart.get(storage.class_limit_mode.key) == 'custom';

            if (!colsc || !colsc(0)) return;

            var max_w = 0;
            _.each(rbreaks, function(v) {
                max_w = Math.max(max_w, String(v).length);
            });
            _.each(breaks, function(val, i) {
                var x = w*1.25 + i * w,
                    bh = 23 + (max_w > 5 ? i * h : 0),
                    d;
                d = $('<div />').addClass('limit').appendTo(cnt)
                        .css({ left: x - w, height: bh })
                        .addClass(fixed[i] !== null ? 'fixed' : '')
                        .data('break-index', i);
                $('<div />').addClass('bg').appendTo(d)
                    .css({
                        background: i < breaks.length-1 ? colsc(val).hex() : 'none',
                        width: w
                    });
                var lbl = $('<div />').addClass('lbl').text(rbreaks[i]).appendTo(d);

                if (custom_limits) {
                    lbl.initInlineEditing()
                       .on('blur', function(evt) {
                        var lbl = $(evt.target),
                            limit = lbl.parent(),
                            val = +lbl.text(),
                            index = limit.data('break-index'),
                            fixed = get_fixed_custom_limits();

                        if (val == lbl.data('old-value')) return; // no change
                        fixed[index] = val;
                        // check fixed
                        var filt = _.filter(fixed, _.isNumber);
                            isUnsorted = _.some(filt, function(val, i) {
                                return i > 0 && val < filt[i-1];
                            });

                        if (!isUnsorted) {
                            chart.set(storage.custom_limits.key, fixed);
                            updateUI();
                        }
                        initCustomClassLimits();
                    });
                }
                cnt.height(bh);
            });

            if (!custom_limits) return;

            function breakChange(evt) {

            }

            uis.custom_limits_reset.off('click');
            if (_.isNumber(_.find(get_fixed_custom_limits(true), function(v) { return !_.isNull(v); }))) {
                // user has set a custom limit, so activate reset button
                uis.custom_limits_reset.prop('disabled', false);
                uis.custom_limits_reset.click(function() {
                    chart.set(storage.custom_limits.key, []);
                    updateUI();
                });
            } else {
                uis.custom_limits_reset.prop('disabled', true);
            }
        }

        function get_fixed_custom_limits(noMinMax) {
            var break_mode = chart.get(storage.class_limit_mode.key),
                classes = chart.get(storage.classes_number.key),
                fixed = chart.get(storage.custom_limits.key, []).slice(0),
                min = column.range()[0] !== null ? column.range()[0] : 0,
                max = column.range()[1] !== null ? column.range()[1] : 0;
            if (break_mode == 'nice') {
                var b = get_breaks();
                _.each(_.range(1, b.length-1), function(i) { b[i] = null; });
                return b;
            }
            if (!fixed.length) fixed = _.times(classes+1, function() { return null; });
            if (!noMinMax) {
                if (fixed[0] === null) fixed[0] = min;
                if (fixed[fixed.length-1] === null) fixed[fixed.length-1] = max;
            }
            return fixed;
        }

        function toggleCustomLimitsUI() {
            if (chart.get(storage.class_limit_mode.key) != 'custom') {
                uis.custom_limits_reset.parent().hide();
            } else {
                uis.custom_limits_reset.parent().show();
            }
        }

        function updateUI() {
            function u() {
                serialize_colors();
                initialize_fields();
            }
            clearTimeout(_updateUI);
            _updateUI = setTimeout(u, 200);
        }

    });

    dw.backend.on('unsync-option:color-gradient-selector', function() {
        backendEvents.off();
    });

});



// EOF
