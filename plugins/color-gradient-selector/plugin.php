<?php

class DatawrapperPlugin_ColorGradientSelector extends DatawrapperPlugin {

    public function init() {
        $plugin = $this;
        global $app;

        DatawrapperHooks::register(
            DatawrapperHooks::VIS_OPTION_CONTROLS,
            function($o, $k) use ($app, $plugin) {
                $env = array('option' => $o, 'key' => $k);
                $app->render('plugins/' . $plugin->getName() . '/controls.twig', $env);
            }
        );

        $this->declareAssets(
            array('sync-controls.js', 'styles.css', 'vendor/d3.js', 'vendor/jquery.gradient.js'),
            "|/chart/[^/]+/visualize|"
        );
    }
}