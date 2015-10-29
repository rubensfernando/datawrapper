$(function() {

    var backendEvents = dw.backend;

    dw.backend.on('sync-option:color-category-selector', function(args) {

        var rt = $('#vis-options-'+args.key),
            chart = args.chart,
            column = args.vis.axes(true)[args.option.keys];

        // initialize preset HTML from theme gradients
        backendEvents
            .on('theme-loaded', initCategoryPresets)
            .on('theme-loaded', initCustomizeColors);

        // check if themes are already loaded
        if (dw.theme($('#select-theme').val())) {
            initCustomizeColors();
            initCategoryPresets();
        }

        // initialize link to show all colors
        $('.show-all', rt).click(function(e) {
            e.preventDefault();
            $('.custom-colors', rt).removeClass('truncate-12');
        });

        $('.reset-colors', rt).click(function(e) {
            e.preventDefault();
            chart.set('metadata.visualize.custom-colors', undefined);
            initCustomizeColors();
        });

        /*
         * populates the preset colors
         */
        function initCategoryPresets() {
            var theme = dw.theme($('#select-theme').val()),
                $presets = $('.presets', rt).html('');
            _.each(theme.colors.categories, function(colors, i) {
                $('<a>')
                    .attr('href', '#')
                    .data('colors', colors)
                    .data('index', i)
                    .appendTo($('<li>').appendTo($presets));
            });
            // If there is no serialized color (needed by visualization), we load the first preset

            // Colorize presets in selectbox
            $('.presets li', rt).each(function(i, option) {
                option = $(option);
                if (!option.find('a').data('colors')) return;
                var colors = option.find('a').data('colors').slice(0, 8), // only show the first 9 colors
                    demo = option.find('a');

                _.each(colors, function(color, i) {
                    var w = 15,
                        x = 5 + w * i;
                    $('<div />')
                        .addClass('step')
                        .css({ background: color })
                        .appendTo(demo);
                });
            });
            //  bind events
            $('.presets li a', rt).click(function(e) {
                e.preventDefault();
                var a = $(e.currentTarget);
                $('.display', rt).html(a.html());
                chart.set('metadata.visualize.category-color-preset', a.data('index'));
                initCustomizeColors();
            });

            // auto-fill selected preset
            var s = chart.get('metadata.visualize.category-color-preset', 0) % theme.colors.categories.length;
            $('.display', rt).html($($('.presets li a', rt).get(s)).html());
        }

        function initCustomizeColors() {
            var theme = dw.theme($('#select-theme').val()),
                colors = theme.colors.categories[chart.get('metadata.visualize.category-color-preset', 0)], // use first set of colors defined in theme for now
                num_colors = colors.length,
                // the container for custom color swatches
                customColorsCont = $('.custom-colors', rt),
                uniqueKeys = _.unique(column.raw()),

                // initialize function key --> color
                getColor = (function() {
                    var catColors = $.extend({}, chart.get('metadata.visualize.custom-colors', {})),
                        pos = 0;

                    return function(cat) {
                        if (!catColors[cat]) {
                            catColors[cat] = colors[pos % num_colors];
                            pos++;
                        }
                        return catColors[cat];
                    };
                })();

            // clear old swatches
            $('.category-color', customColorsCont).remove();

            // add new swatchs
            _.each(uniqueKeys, function(val) {
                var d = $('<div />')
                    .addClass('category-color')
                    .appendTo(customColorsCont),

                col = $('<div />')
                    .addClass('color')
                    .css({ background: getColor(val) })
                    .appendTo(d);

                $('<div />')
                    .addClass('key-label')
                    .attr('title', val)
                    .html(val)
                    .appendTo(d);

                d.click(function() {
                    col.colorselector({
                        color: getColor(val),
                        palette: [].concat(colors, theme.colors.palette, theme.colors.secondary),
                        change: function(color) {
                            col.css({ background: color });
                            console.log('set ', color,'for', val);
                            console.log(chart.get('metadata.visualize.custom-colors'));
                            chart.set('metadata.visualize.custom-colors.'+val, color);
                            console.log(chart.get('metadata.visualize.custom-colors'));
                        }
                    });
                });
            });

            if (uniqueKeys.length > 16) {
                customColorsCont.addClass('truncate-12');
            } else {
                customColorsCont.removeClass('truncate-12');
            }
        }

    });

    dw.backend.on('unsync-option:color-category-selector', function() {
        backendEvents.off();
    });

});

// EOF
