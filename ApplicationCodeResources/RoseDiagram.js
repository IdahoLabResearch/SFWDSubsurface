// CMV \viewer\js\gis\dijit\RoseDiagram - Overview
// Code refined to show key functionality


define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/aspect',
    'dojo/_base/lang',
    'dijit/registry',
    'dijit/layout/ContentPane',
    'esri/toolbars/draw',
    'esri/tasks/query',
    "esri/layers/FeatureLayer",
    'esri/symbols/CartographicLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/tasks/Geoprocessor',
    'esri/tasks/FeatureSet',
    'esri/graphic',
    'esri/Color',
	
    'dojo/text!./RoseDiagram/templates/RoseDiagram.html',
    'dijit/form/Select',
    'dijit/form/Button',
    'dijit/form/CheckBox',

    'xstyle/css!./RoseDiagram/css/RoseDiagram.css',
    'xstyle/css!./RoseDiagram/css/Draw.css'

], function (
    declare,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    domClass,
    domConstruct,
    topic,
    aspect,
    lang,
    registry,
    ContentPane,
    Draw,
    Query,
    FeatureLayer,
    CartographicLineSymbol,
    SimpleFillSymbol, 
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Geoprocessor,
    FeatureSet,
    Graphic,
    Color,

    template
) {

    var stressFieldsFeatureLayer = new FeatureLayer("<feature layer service url>",
        {
        mode: FeatureLayer.MODE_SELECTIONONLY,
        outFields: ["*"]
        });

    stressFieldsFeatureLayer.clearSelection();

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: template,
        baseClass: 'cmvRoseDiagramWidget',

        toolbar: null,
        polygonSymbol: null,
        pane: null,
        currentPolygon: null,

        title: 'Stress Fields Rose Diagram',
        nodeID: 'RoseDiagramChartNode',

        RoseDiagramOverlayNode: domConstruct.create('RoseDiagramOverlayNode'),
        attributesContainerID: 'attributesContainer',

        //current line feature
        currGraphic: null,

        postCreate: function () {
            this.inherited(arguments);

            if (this.parentWidget) {
                if (this.parentWidget.toggleable) {
                    this.own(aspect.after(this.parentWidget, 'toggle', lang.hitch(this, function () {
                        this.onLayoutChange(this.parentWidget.open);
                    })));
                }
            }

            this.polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                new CartographicLineSymbol(CartographicLineSymbol.STYLE_SOLID,
                new Color([255,0,0]), 2),new Color([190,190,190,0.65])
              );


			this.gp = new Geoprocessor(this.RoseDiagramProfileServiceURL); 
            this.gp.setOutSpatialReference({ "wkid": this.map.spatialReference.wkid });

            this.own(topic.subscribe('mapClickMode/currentSet', lang.hitch(this, 'setMapClickMode')));
        },

        initElevation: function () {

            if (!this.tableWidget) {
                this.tableWidget = registry.byId(this.attributesContainerID + '_widget');
            }

            if (!this.tableWidget) {
                topic.publish('viewer/handleError', {
                    error: 'Rose Digram: The Attributes Table widget could not be found or created.'
                });
                return;
            }

            //open the bottom pane
            topic.publish(this.attributesContainerID + '/openPane');

            var tabs = null;

            if (!this.pane) {
                this.pane = new ContentPane({
                    title: this.title,
                    closable: false,
                    content: '<div id="' + this.nodeID + '"></div>',

                });
                tabs = this.tableWidget.tabContainer;
                tabs.addChild(this.pane);
            }


            if (!this.toolbar) {
                this.toolbar = new Draw(this.map);
                this.toolbar.on('draw-complete', lang.hitch(this, 'addGraphic'));
                this.toolbar.on('draw-complete', lang.hitch(this, 'submitJob'));
            }

            tabs = this.tableWidget.tabContainer;
            tabs.selectChild(this.pane);

            this.RoseDiagramBtnClear.set('disabled', false);
            this.map.graphics.clear();
            this.map.disableMapNavigation();
            this.disconnectMapClick();
        },

        submitJob: function (evt) {
            this.currGraphic = new Graphic(evt.geometry);
            myFeatureSet = new FeatureSet();
            myFeatureSet.features = [this.currGraphic];
            this.gp.submitJob(
                { SelectionPolygon: myFeatureSet },
                lang.hitch(this, 'stackCompleteCallback'),
            );

            dojo.place(this.RoseDiagramOverlayNode, this.nodeID, "first");

            domClass.add(this.RoseDiagramOverlayNode, "RoseDiagramLoadingOverlay");

            this.selectFeatures(evt.geometry);
        },

        stackCompleteCallback: function (jobInfo) {
            this.gp.getResultData(
                jobInfo.jobId,
                'outputAzimuthHist',
                lang.hitch(this, 'dataCallback'),
                lang.hitch(this, 'dataErrback'),
                
            );
            domClass.remove(this.RoseDiagramOverlayNode, "RoseDiagramLoadingOverlay")

        },

        selectFeatures: function (geometry) {
            
            stressFieldsFeatureLayer.clearSelection();

            var selectionSymbol = new SimpleMarkerSymbol(
                SimpleMarkerSymbol.STYLE_CIRCLE, 
                12, 
                new SimpleLineSymbol(
                SimpleLineSymbol.STYLE_NULL, 
                new Color([247, 34, 101, 0.9]), 
                1
                ),
                new Color([255, 0, 240, 1])
            );
            
            stressFieldsFeatureLayer.setSelectionSymbol(selectionSymbol);

            if (!!stressFieldsFeatureLayer) {

                var query = new Query();
                query.geometry = geometry;

                stressFieldsFeatureLayer.selectFeatures(query, stressFieldsFeatureLayer.SELECTION_NEW);
                this.map.addLayer(stressFieldsFeatureLayer);
                }

          },


        stackCompleteCallback: function (jobInfo) {
            this.gp.getResultData(
                jobInfo.jobId,
                'outputAzimuthHist',
                lang.hitch(this, 'dataCallback'),
                lang.hitch(this, 'dataErrback'),
                
            );
            domClass.remove(this.RoseDiagramOverlayNode, "RoseDiagramLoadingOverlay")

        },

        dataCallback: function (data) {

            let returnString = data.value; 
            chartData = returnString

            

            var data = [{
                r: chartData,
                theta: ["5","10","15","20","25","30","35","40","45","50","55","60","65","70","75","80","85","90","95","100","105","110","115","120","125","130","135","140","145","150","155","160","165","170","175","180","185","190","195","200","205","210","215","220","225","230","235","240","245","250","255","260","265","270","275","280","285","290","295","300","305","310","315","320","325","330","335","340","345","350","355","360"],
                name: "",
                text: ["5°","10°","15°","20°","25°","30°","35°","40°","45°","50°","55°","60°","65°","70°","75°","80°","85°","90°","95°","100°","105°","110°","115°","120°","125°","130°","135°","140°","145°","150°","155°","160°","165°","170°","175°","180°","185°","190°","195°","200°","205°","210°","215°","220°","225°","230°","235°","240°","245°","250°","255°","260°","265°","270°","275°","280°","285°","290°","295°","300°","305°","310°","315°","320°","325°","330°","335°","340°","345°","350°","355°","360°"],
                marker: {color: "rgb(134,171,185)"},
                hovertemplate: '<b>Count</b>: %{r}' + '<br><b>Orientation bin</b>: %{text}<br>',
                type: "barpolar",
                fillcolor: '#86ABB9',
                line: {
                  color: 'black'
                }
              }, 
            ]
            var layout = {
                title: "<b>Orientation Values for Selected Stress Fields<b>",
                font: {size: 14, fontweight: "bold"},
                "titlefont": {
                    "size": 16
                  },

                height: 400,
                hoverlabel: { bgcolor: "#FFF"},
                polar: {
                  barmode: "overlay",
                  bargap: 0,
                  radialaxis: {visible: false, ticksuffix: "", angle: 0, dtick: 5},
                  angularaxis: {
                      gridcolor: '#f5f5f5',
                      gridwidth: 0.5,
                      direction: "clockwise", 
                      nticks: 15, 
                      ticks: "outside", 
                      ticktext: ["","","","","","","","","45°","","","","","","","","","90°","","","","","","","","","135°","","","","","","","","","180°","","","","","","","","","225°","","","","","","","","","270°","","","","","","","","","315°","","","","","","","","","360°"],
                      tickvals: ["5","10","15","20","25","30","35","40","45","50","55","60","65","70","75","80","85","90","95","100","105","110","115","120","125","130","135","140","145","150","155","160","165","170","175","180","185","190","195","200","205","210","215","220","225","230","235","240","245","250","255","260","265","270","275","280","285","290","295","300","305","310","315","320","325","330","335","340","345","350","355","360"],
                    },
                  text: "Count",
                  bgcolor: 'white'
                }
              }
            
            Plotly.newPlot(this.nodeID, data, layout)
            
            delete chartData;
        },

        dataErrback: function (err) {
            console.error("azimuth data error: ", err);
        },

        addGraphic: function (evt) {
            this.currentPolygon = evt.geometry;
            this.toolbar.deactivate();
            this.connectMapClick();
            this.map.enableMapNavigation();
            var symbol = this.polygonSymbol;
            this.map.graphics.add(new Graphic(evt.geometry, symbol));
            this.RoseDiagramBtnClear.set('disabled', false);
        },

        onToggleLayer: function (newState) {

            var potsitguidelines = this.map.getLayer('potsitguidelines'); 
            this.map.addLayer(potsitguidelines)
            potsitguidelines.setVisibleLayers([10])
            potsitguidelines.setVisibility(newState);

        },

        onPolygon: function () {
            this.map.removeLayer(stressFieldsFeatureLayer);
            stressFieldsFeatureLayer.clearSelection();
            this.initElevation();
            this.toolbar.activate('polygon');
        },

        onFreehandPolygon: function () {
            this.map.removeLayer(stressFieldsFeatureLayer);
            stressFieldsFeatureLayer.clearSelection();
            this.initElevation();
            this.toolbar.activate('freehandpolygon');
        },

        onCircle: function () {
            this.map.removeLayer(stressFieldsFeatureLayer);
            stressFieldsFeatureLayer.clearSelection();
            this.initElevation();
            this.toolbar.activate('circle');
        },

        onClear: function () {
            if (this.toolbar) {
                this.toolbar.deactivate();
            }
            this.map.removeLayer(stressFieldsFeatureLayer);
            stressFieldsFeatureLayer.clearSelection();
            this.map.graphics.clear();
            this.RoseDiagramBtnClear.set('disabled', false);
        },

        onLayoutChange: function (open) {
            if (!open) {
                this.connectMapClick();
                this.map.graphics.clear();
                this.map.setMapCursor('default');
            }
        },

        disconnectMapClick: function () {
            topic.publish('mapClickMode/setCurrent', 'RoseDiagram');
        },

        connectMapClick: function () {
            if (this.mapClickMode === 'RoseDiagram') {
                topic.publish('mapClickMode/setDefault');
            }
        },

        setMapClickMode: function (mode) {
            if (mode !== 'RoseDiagram') {
                if (this.toolbar && this.toolbar.activated) {
                    this.disconnectMapClick();
                    return;
                }
            }
            this.mapClickMode = mode;
        }
    });
});

// configurations provided in \viewer\js\config\RoseDiagram.js:

define([], function () {
    return {
        map: true,
        mapClickMode: true,
        RoseDiagramProfileServiceURL: "<geoprocessing service URL>",

    };
})

//HTML (i.e. viewer\js\gis\dijit\RoseDiagram\templates\RoseDiagram.html):

<div>

    <div class="layerControlToggleIcon">
        <label>View stress fields layer:</label>

    <select data-dojo-type="dijit/form/CheckBox" data-dojo-props="iconClass:'dijitCheckBoxIcon', checked: false" data-dojo-attach-point="btnToggle" id="RoseDiagram" data-dojo-attach-event="onChange:onToggleLayer" style="background-color: white; font-weight: bold; color:#090; -webkit-text-stroke-width: 1px; -webkit-text-stroke-color: #090; -webkit-text-fill-color: #090;">
    </select>
</div><br/>

    <div>
        <label>Digitize a selection area:</label><br>
        <button data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'draw-icon-polygon fas fa-fw',showLabel:false,disabled:false" data-dojo-attach-point="btnPolygon" data-dojo-attach-event="click:onPolygon" title="Draw Polygon"></button>
        <!-- <button data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'draw-icon-freehand-polygon fas fa-fw',showLabel:false,disabled:false" data-dojo-attach-point="btnFreehandPolygon" data-dojo-attach-event="click:onFreehandPolygon" title="Draw Freehand Polygon"></button> -->
        <button data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'draw-icon-circle fas fa-fw',showLabel:false,drawType:'CIRCLE',disabled:false" data-dojo-attach-point="btnCircle" data-dojo-attach-event="click:onCircle" title="Draw Circle"></button>
        <button style="margin-left:20px;" data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'fa fa-times fa-fw',showLabel:false,disabled:true" data-dojo-attach-point="RoseDiagramBtnClear" data-dojo-attach-event="click:onClear" title="Clear Drawing and Features"></button>
    </div>

</div>

//CSS (i.e. viewer\js\gis\dijit\RoseDiagram\css\RoseDiagram.css):

.cmvStackedProfileHeatflowWidget .elevationMeasurementUnits {
    float: right;
    height: 100px;
    margin-left: 20px;
    width: 150px;
}

.cmvStackedProfileHeatflowWidget label {
    margin-left: 5px;
}

.dijitTabPaneWrapper{
    overflow-y: auto; 
    overflow-x: auto;
 }

.RoseDiagramOverlayNode {
    height: calc(90% - 20px)!important;
    width: calc(100% - 5px) !important;
    min-height: 150px ;
    position: relative;
    top: 1px;
    z-index: 1;
    left: 1px;
    bottom: 1px;
    overflow: visible;
}


#RoseDiagramChartNode {
    height: calc(100% - 2px) !important;
    left: 1px;
    min-height: 200px !important;
    position: relative;
    top: 1px;
    width: calc(100% - 5px) !important;
    overflow: visible; 
    bottom: 2px;   
} 

.RoseDiagramLoadingOverlay {
    width: calc(100% - 5px) !important;
    position: absolute;
    background:  rgba(155, 208, 255, 0) url('https://js.arcgis.com/3.24compact/esri/dijit/images/loading-throb.gif') no-repeat center;
    z-index: 9;
    height: calc(90% - 20px) !important;
    left: 1px;
    bottom: 1px;
    top: 1px;
    overflow: visible;
    
}

.modebar{
    display: none !important;
}

.js-plotly-plot .plotly .main-svg {
    position: absolute;
    top: 0px;
    left: 0px;
    pointer-events: none;
    font-weight: bold;
}