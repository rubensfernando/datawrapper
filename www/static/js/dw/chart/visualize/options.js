
define(
    ['./options/initCustomColors', './options/syncVisOptions', './options/unsyncVisOptions'],

function(initCustomColors, syncVisOptions, unsyncVisOptions) {

    var _chart, _vis;

    return {
        init: function(chart, vis) {
            _chart = chart;
            _vis = vis;
        },

        sync: function() {
            syncVisOptions(_vis, _chart);
            $('.select-row').hide();
            initCustomColors(_chart);

            $('.vis-option-help').tooltip({
                placement: 'right',
                html: true,
                delay: 0,
                animation: false,
                trigger: 'hover focus',
                container: '#vis-options'
            });

            $('.vis-option-type-group label').click(function() {
                $(this).parents('.vis-option-type-group').toggleClass('group-open');
            });
        },

        reset: function() {
            unsyncVisOptions(_vis, _chart);
        }


    };

});
