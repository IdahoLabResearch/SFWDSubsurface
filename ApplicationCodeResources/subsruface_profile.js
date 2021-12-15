// CMV viewer\js\gis\dijit\SubsurfaceProfile - Overview
// Code refined to show key functionality 

//additional y-axis added to accomodate geophysical parameters of interest (with separate plots and data series)

define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    'dojox/charting/Chart',
    'dojox/charting/Theme',
    'dojox/gfx/gradutils',
	'dojox/charting/action2d/Tooltip',
    'dojox/charting/action2d/MouseIndicator',

    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/aspect',
    'dojo/_base/lang',
    'dijit/registry',
    'dijit/layout/ContentPane',

    'esri/toolbars/draw',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/CartographicLineSymbol',
    'esri/geometry/Point',
    'esri/tasks/Geoprocessor',
    'esri/tasks/FeatureSet',
    'esri/graphic',
    'esri/Color',

    'dojo/text!./SubsurfaceProfile/templates/SubsurfaceProfile.html',

    'dijit/form/Select',
    'dijit/form/Button',

    'xstyle/css!./SubsurfaceProfile/css/SubsurfaceProfile.css',
    'xstyle/css!./SubsurfaceProfile/css/Draw.css'

], function (
    declare,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,

    Chart,
    Theme,
    gradient,
    Tooltip,
    MouseIndicator,

    domClass,
    domConstruct,
    topic,
    aspect,
    lang,
    registry,
    ContentPane,

    Draw,
    SimpleMarkerSymbol,
    CartographicLineSymbol,
    Point,
    Geoprocessor,
    FeatureSet,
    Graphic,
    Color,

    template
) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: template,
        baseClass: 'cmvSubsurfaceProfileWidget',

        toolbar: null,
        lineSymbol: null,
        displayUnit: null,
        pane: null,
        gp: null,
        currentLine: null,
        loadingOverlay: null,

        title: 'Subsurface Profile',
        nodeID: 'stackedChartNode',

        stackedOverlayNode: domConstruct.create('stackedOverlayNode'),

        attributesContainerID: 'attributesContainer',

        //config options
        ProfileServiceURL: "",
        XField: "",
        ZField: "",
        SourceField: "",
        SurfaceElevationProfile: "",
        BedrockElevationProfile: "",
        horizontalMeasurementUnits: "",
        verticalMeasurementUnits: "",

        ShaleFormations: "", 
        SaltFormations: "", 

        // Shale Formations:
        AtrimShale: "",
        BakkenShale: "",
        // ..add formations as needed

        //Salt Deposits:
		LowerClearForkSalt: "",
		NewHutchinsonSalt: "",
		// ..add formations as needed

        //current line feature
        currGraphic: null,
        currMapMarker: null,
        markerSymbol: null,

        unitConversions: {
            'METERS': 1,
            'FEET': .3048,
            'MILES': 1609.34,
            'KILOMETERS': 1000
        },

        unitAbbrev: {
            'METERS': 'm',
            'FEET': 'ft',
            'MILES': 'mi',
            'KILOMETERS': 'km'
        },

        chartActions: [],

        postCreate: function () {
            this.inherited(arguments);

            if (this.parentWidget) {
                if (this.parentWidget.toggleable) {
                    this.own(aspect.after(this.parentWidget, 'toggle', lang.hitch(this, function () {
                        this.onLayoutChange(this.parentWidget.open);
                    })));
                }
            }
            this.displayUnit = registry.byId('stackedUnitsSelect').value;

            this.lineSymbol = new CartographicLineSymbol(
                CartographicLineSymbol.STYLE_SOLID,
                new Color([0, 0, 0]), 3,
                CartographicLineSymbol.CAP_ROUND,
                CartographicLineSymbol.JOIN_MITER, 2
            );
            this.markerSymbol = new SimpleMarkerSymbol({
                type: "esriSMS",
                style: "esriSMSX",
                color: [0, 0, 0, 255],
                size: 13,
                angle: 0,
                xoffset: 0,
                yoffset: 0,
                outline: {
                    type: "esriSLS",
                    style: "esriSLSSolid",
                    color: [0, 0, 0, 255],
                    width: 3
                }
            });
            this.gp = new Geoprocessor(this.ProfileServiceURL);
            this.gp.setOutSpatialReference({ "wkid": this.map.spatialReference.wkid });
            this.own(topic.subscribe('mapClickMode/currentSet', lang.hitch(this, 'setMapClickMode')));
        },

        initElevation: function () {
            if (!this.tableWidget) {
                this.tableWidget = registry.byId(this.attributesContainerID + '_widget');
            }

            if (!this.tableWidget) {
                topic.publish('viewer/handleError', {
                    error: 'Subsurface Profile: The Attributes Table widget could not be found or created.'
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
                    content: '<div id="' + this.nodeID + '"></div>'

                });
                tabs = this.tableWidget.tabContainer;
                tabs.addChild(this.pane);
            }

            if (!this.chart) {
                gradient = Theme.generateGradient;
                defaultFill = { type: "linear", space: "shape", x1: 0, y1: 0, x2: 0, y2: 100 };
                let customTheme = new Theme({
                    chart: {
                        fill: '#fff',
                        stroke: {
                            color: '#fff'
                        }
                    },
                    plotarea: {
                        fill: gradient(defaultFill, '#69adfe', '#99ccff') //sky color gradient
                    },
                    markers: {
                        SQUARE: "m-6,-6 12,0 0,12 -12,0z",
                    }
                });
                this.chart = new Chart(this.nodeID);
                this.chart.setTheme(customTheme);


                // Shale plot:
                if (!!this.ShaleFormations) {
                    this.chart.addPlot("shalePlot", {type: "Lines", markers: false, animate: false, labels: true, labelStyle: "inside", labelOffset: 0 });

                    
                    new Tooltip(this.chart, "shalePlot", {
                        font: "normal normal bold 5pt Tahoma",
                        defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],

                        text: function(o){
                            return o.run.name + " Shale";
                        }
                    }); 
                    
                }
                
                // Salt plot:
                if (!!this.SaltFormations) {
                    this.chart.addPlot("saltPlot", {type: "Lines", markers: false, animate: false, labels: true, labelStyle: "inside", labelOffset: 0 });
                    //console.log("added salt plot: ",!!(this.SaltFormations))  

                    new Tooltip(this.chart, "saltPlot", {
                        font: "normal normal bold 5pt Tahoma",
                        defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],

                        text: function(o){
                            return o.run.name + " Salt";
                        }
                    });
                }
                

                if (!!this.SurfaceElevationProfile) {
                    this.chart.addPlot("Grid", { type: "Grid", hAxis: "x", vAxis: "y", hMajorLines: true, vMajorLines: false, hMinorLines: false, vMinorLines: false, majorHLine: { color: "white", width: 0.5 } });
                };

                if (!!this.BedrockElevationProfile) {
                    this.chart.addPlot("bedrockPlot", { type: "Areas", markers: false });
                    
                    new Tooltip(this.chart, "bedrockPlot", {
                        font: "normal normal bold 20pt Tahoma",
                        defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],
                        text: function(o){

                            return "Crystalline Basement"
                        }
                    });

                };

                if (!!this.SurfaceElevationProfile) {
                    this.chart.addPlot("surfacePlot", { type: "Areas", markers: false });

                    new Tooltip(this.chart, "surfacePlot", {
                        defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],

                         text: function(o){
                            return "Surface" 
                        } 
                    }); 
                };


                this.unit = this.unitAbbrev[this.displayUnit.toUpperCase()] || '';

                this.chart.addAxis("x",
                    {

                        title: "Distance" + " " + "(" + this.unit + ")", 
                        titleOrientation: 'away',
                        titleFont: "normal normal bold 12pt Helvetica",
                        titleFontColor: "gray",
                        horizontal: true,
						
                        font: "normal normal bold 10pt Helvetica",
                        fontColor: 'gray',
                        majorTick: { color: 'gray', length: 4 },
                        minorTick: { stroke: 'gray', length: 3 },

                    });

                this.chart.addAxis("y", {
                    vertical: true,

                    title: "Elevation (m)",
                    titleFont: "normal normal bold 12pt Helvetica",
                    titleFontColor: "gray",
                    leftBottom: true,
                    fixLower: "major",
                    fixUpper: "major",

                    font: "normal normal bold 10pt Helvetica",
                    fontColor: 'gray',
                    majorTick: { color: 'gray', length: 4 },
                    minorTick: { stroke: 'gray', length: 3 }
                });
                this.chart.render();
            }
            else {
                //clear the chart

                this.chart.removeAxis("x");

                //clear old actions
                var len = this.chartActions.length;
                for (let i = 0; i < len; i++) {
                    this.chartActions[i].destroy();
                }
                this.chartActions = [];

                this.unit = this.unitAbbrev[this.displayUnit.toUpperCase()] || '';

                this.chart.addAxis("x",
                    {

                        title: "Distance" + " " + "(" + this.unit + ")",

                        titleOrientation: 'away',
                        titleFont: "normal normal bold 12pt Helvetica",
                        titleFontColor: "gray",
                        horizontal: true,

                        font: "normal normal bold 10pt Helvetica",
                        fontColor: 'gray',
                        majorTick: { color: 'gray', length: 4 },
                        minorTick: { stroke: 'gray', length: 3 },

                    });

                this.chart.render();


                if (!!this.ShaleFormations) {
                    let series = this.chart.getSeriesOrder("shalePlot")
                    for (let i = 0; i < series.length; i++) {
                        this.chart.removeSeries(series[i]);
                    }
                }

                if (!!this.SaltFormations) {
                    let series = this.chart.getSeriesOrder("saltPlot")
                    for (let i = 0; i < series.length; i++) {
                        this.chart.removeSeries(series[i]);
                    }
                }

                if (!!this.SurfaceElevationProfile) {
                    let series = this.chart.getSeriesOrder("surfacePlot");
                    for (let i = 0; i < series.length; i++) {
                        this.chart.removeSeries(series[i]);
                    }
                }
                if (!!this.BedrockElevationProfile) {
                    let series = this.chart.getSeriesOrder("bedrockPlot");
                    for (let i = 0; i < series.length; i++) {
                        this.chart.removeSeries(series[i]);
                    }
                }
                this.chart.render();
            }

            if (!this.toolbar) {
                this.toolbar = new Draw(this.map);
                this.toolbar.on('draw-end', lang.hitch(this, 'addGraphic'));
                this.toolbar.on('draw-end', lang.hitch(this, 'submitJob'));

            }

            tabs = this.tableWidget.tabContainer;
            tabs.selectChild(this.pane);

            this.stackedBtnClear.set('disabled', false);
            this.map.graphics.clear();
            this.map.disableMapNavigation();
            this.disconnectMapClick();

            this.chart.render(); 
            this.chart.resize();
        },

        submitJob: function (evt) {
            this.currGraphic = new Graphic(evt.geometry);

            myFeatureSet = new FeatureSet();
            myFeatureSet.features = [this.currGraphic];


            this.gp.submitJob(
                { profileschemaWM: myFeatureSet },
                lang.hitch(this, 'stackCompleteCallback'),

            );
            dojo.place(this.stackedOverlayNode, this.nodeID, "before");

            domClass.add(this.stackedOverlayNode, "stackedLoadingOverlay")
        },

        stackCompleteCallback: function (jobInfo) {
            this.gp.getResultData(
                jobInfo.jobId,
                'FinalTable',
                lang.hitch(this, 'dataCallback'),
                lang.hitch(this, 'dataErrback')
            );
            domClass.remove(this.stackedOverlayNode, "stackedLoadingOverlay");
        },

        dataCallback: function (data) {
            let features = data.value.features;
            let chartData = {};
            if (Array.isArray(features) && features.length > 0) {
                features = features.map(lang.hitch(this, 'getFeatureAttributes'));
                for (let i = 0; i < features.length; i++) {
                    const f = features[i];
                    if (chartData[f[this.SourceField]] === undefined) {
                        chartData[f[this.SourceField]] = [];
                    }
                    chartData[f[this.SourceField]].push(f);
                }
            }


            //if a surface elevation layer is specified, add it to its own plot
            if (!!this.SurfaceElevationProfile && chartData[this.SurfaceElevationProfile]) {
                let surfaceData = chartData[this.SurfaceElevationProfile];
                this.chart.addSeries(this.SurfaceElevationProfile, surfaceData, {
                    plot: "surfacePlot",
                    stroke: { color: "#DEB887" },
                    fill: gradient(defaultFill, '#d1b59a', '#996532'),
                    stroke: { width: 0, color: '#ad8f70' }

                });

                this.chartActions.push(new MouseIndicator(this.chart, "surfacePlot", {
                    series: this.SurfaceElevationProfile,
                    mouseOver: true,
                    fill: '#474747',
                    markerStroke: '#474747',
                    lineStroke: '#474747',
                    stroke: '#474747',
                    markerStroke: '#474747',
                    markerFill: '#474747',
                    vertical: true,
                    font: "normal normal bold 10pt Tahoma",
                    labelFunc: lang.hitch(this, function (v) {
                        var unit = this.unitAbbrev[this.verticalMeasurementUnits.toUpperCase()] || '';
                        return "Surface: " + v.y.toFixed(0) + " " + unit;
                    }),
                    offset: {
                        y: 5,
                        x: 60
                    },
                    fillFunc: lang.hitch(this, "markChartPosition"),
                }));
                delete chartData[this.SurfaceElevationProfile];
            }
            //if a bedrock elevation layer is specified, add it to its own plot
            if (!!this.BedrockElevationProfile && chartData[this.BedrockElevationProfile]) {
                let bedrockData = chartData[this.BedrockElevationProfile];
                this.chart.addSeries(this.BedrockElevationProfile, bedrockData, {
                    plot: "bedrockPlot",
                    stroke: { color: "#DEB887" },
                    fill: gradient(defaultFill, '#b8a89e', '#79685a'),
                    stroke: { width: 4, color: '#56493c' }
                });
                //var graphUnit = this.displayUnit;
                this.chartActions.push(new MouseIndicator(this.chart, "bedrockPlot", {
                    series: this.BedrockElevationProfile,
                    mouseOver: true,
                    fill: '#474747',
                    markerStroke: '#474747',
                    lineStroke: '#474747',
                    stroke: '#474747',
                    markerStroke: '#474747',
                    markerFill: '#474747',
                    vertical: true,
                    font: "normal normal bold 10pt Tahoma",
                    labelFunc: lang.hitch(this, function (v) {
                        var unit = this.unitAbbrev[this.verticalMeasurementUnits.toUpperCase()] || '';
                        return "Crystalline Basement: " + v.y.toFixed(0) + " " + unit;

                    }),
                    offset: {
                        y: 150,
                        x: 115
                    },
                    fillFunc: function () { return 'ltgray'; }
                }));
                delete chartData[this.BedrockElevationProfile];
            }

                ////////// if a shale layer is specified, add it to shale plot:
                if (!!this.AtrimShale && chartData[this.AtrimShale]) {
                    let atrimShalePlotData = chartData[this.AtrimShale];

                    this.chart.addSeries("Atrium", atrimShalePlotData, {

                        plot: "shalePlot", stroke: { color: "#5B8381" },

                        stroke: { width: 4, color: '#5B8381' },  /// color here line color drawn on chart
                         
                    });      
                    

                    delete chartData[this.AtrimShale];
                }  
                
                if (!!this.BakkenShale && chartData[this.BakkenShale]) {
                    let bakkenShalePlotData = chartData[this.BakkenShale];

                    this.chart.addSeries("Bakken", bakkenShalePlotData, {

                        plot: "shalePlot", stroke: { color: "#5B8381" },

                        stroke: { width: 4, color: '#5B8381' },  /// color here line color drawn on chart
                         
                    });      
                    
                    delete chartData[this.BakkenShale];
                }  
                // add other shale formations as needed
				
                //// Add salts series -- if a salt layer is specified, add it to salt plot
                if (!!this.LowerClearForkSalt && chartData[this.LowerClearForkSalt]) {
                    let lowerClearForkSaltPlotData = chartData[this.LowerClearForkSalt];

                    this.chart.addSeries("Lower Clear Fork" , lowerClearForkSaltPlotData, {

                        plot: "saltPlot", stroke: { color: "#D3BCD2" },

                        stroke: { width: 4, color: '#D3BCD2' },  /// color here line color drawn on chart
                         
                    });      

                    delete chartData[this.LowerClearForkSalt];
                }
                if (!!this.NewHutchinsonSalt && chartData[this.NewHutchinsonSalt]) {
                    let newHutchinsonSaltPlotData = chartData[this.NewHutchinsonSalt];

                    this.chart.addSeries("New Hutchinson" , newHutchinsonSaltPlotData, {

                        plot: "saltPlot", stroke: { color: "#D3BCD2" },

                        stroke: { width: 4, color: '#D3BCD2' },  /// color here line color drawn on chart
                         
                    });      
                    

                    delete chartData[this.NewHutchinsonSalt];
                }
                // add other salt deposits as needed

            this.chart.render();
            this.chart.resize();
            
        },

        dataErrback: function (err) {
            console.error("SubsurfaceProfile data error: ", err);
        },

        getFeatureAttributes(feature) {
            let inUnit = this.unitConversions[this.horizontalMeasurementUnits.toUpperCase()];
            let outUnit = this.unitConversions[this.displayUnit.toUpperCase()];
            let xVal = feature.attributes[this.XField];
            xVal = xVal * (inUnit / outUnit);
            feature.attributes.x = xVal;
            feature.attributes.y = feature.attributes[this.ZField];
            return feature.attributes;
        },


        pythagoras: function (start, finish) {
            return ((start[0] - finish[0]) ** 2 + (start[1] - finish[1]) ** 2) ** (1 / 2);
        },

        markChartPosition: function (evt) {
            //find the correct line segment for the point
            var linePaths = this.currentLine.paths[0];
            let inUnit = this.unitConversions[this.horizontalMeasurementUnits.toUpperCase()];
            let outUnit = this.unitConversions[this.displayUnit.toUpperCase()];
            var remainingDist = evt.x * (outUnit / inUnit);
            var finishIndex = 1;
            var segmentDist = this.pythagoras(linePaths[0], linePaths[1]);
            while (remainingDist > segmentDist && finishIndex < linePaths.length - 1) { 
                remainingDist -= segmentDist;
                var start = linePaths[finishIndex];
                var finish = linePaths[finishIndex + 1];
                //calculate distance between start and finish
                segmentDist = this.pythagoras(start, finish);
                finishIndex++;
            }

            //calculate coordinates
            var start = linePaths[finishIndex - 1];
            var finish = linePaths[finishIndex];
            var multiplier = remainingDist / segmentDist;
            var coords = [];
            for (var i = 0; i < start.length; i++) {
                var coord = start[i] + multiplier * (finish[i] - start[i]);
                coords.push(coord);
            }
            //draw marker on map
            if (this.currMapMarker) {
                this.map.graphics.remove(this.currMapMarker);
            }
            var point = new Point(coords, this.map.spatialReference);
            this.currMapMarker = new Graphic(point, this.markerSymbol);
            this.map.graphics.add(this.currMapMarker);
            return "ltgray";
        },

        addGraphic: function (evt) {
            this.currentLine = evt.geometry;
            this.toolbar.deactivate();
            this.connectMapClick();
            this.map.enableMapNavigation();
            var symbol = this.lineSymbol;
            this.map.graphics.add(new Graphic(evt.geometry, symbol));
            this.stackedBtnClear.set('disabled', false);
        },

        onUnitChange: function (newValue) {
            if (!this.unitConversions.hasOwnProperty(newValue.toUpperCase())) {
                return;
            }
            this.displayUnit = newValue;
            let axis = this.chart.getAxis("x");
            if (axis) {
                axis.title = "Distance - " + this.displayUnit;
            }
        },

        onPolyline: function () {
            this.initElevation();
            this.toolbar.activate('polyline');
        },

        onFreehandPolyline: function () {
            this.initElevation();
            this.toolbar.activate('freehandpolyline');
        },

        onClear: function () {
            if (this.toolbar) {
                this.toolbar.deactivate();
            }

            this.map.graphics.clear();
            this.stackedBtnClear.set('disabled', false);
        },

        onLayoutChange: function (open) {
            if (!open) {
                this.connectMapClick();
                this.map.graphics.clear();
                this.map.setMapCursor('default');
            }
        },

        disconnectMapClick: function () {
            topic.publish('mapClickMode/setCurrent', 'elevationProfile');
        },

        connectMapClick: function () {
            if (this.mapClickMode === 'elevationProfile') {
                topic.publish('mapClickMode/setDefault');
            }
        },

        setMapClickMode: function (mode) {
            if (mode !== 'elevationProfile') {
                if (this.toolbar && this.toolbar.activated) {
                    this.disconnectMapClick();
                    return;
                }
            }
            this.mapClickMode = mode;
        }
    });
});

// configurations provided in: viewer\js\config\SubsurfaceProfile.js:

define([], function () {
    return {
        map: true,
        mapClickMode: true,
        ProfileServiceURL: '<geoprocessing service url>',

        // for chart parameters, update if chart attributes are altered:
        XField: "Distance",
        ZField: "Elevation",


        SourceField: "FormationName",
        SurfaceElevationProfile: "Surface",
        BedrockElevationProfile: "Crystalline_Basement",


        ShaleFormations: "Atrim"||"Bakken", //...add additional layers as needed
        SaltFormations:"Lower_Clear_Fork"||"New_Hutchinson", //...add additional layers as needed


        // Shale Formations:
        AtrimShale: "Atrim",
        BakkenShale: "Bakken",
		//...add additional layers as needed,

        //Salt Formations:
        LowerClearForkSalt: "Lower_Clear_Fork",
        NewHutchinsonSalt: "New_Hutchinson",
		//...add additional layers as needed,


        //default units
        horizontalMeasurementUnits: "METERS", 
        verticalMeasurementUnits: "METERS"
    };
})

//HTML (i.e. viewer\js\gis\dijit\SubsurfaceProfile\templates\SubsurfaceProfile.html):

<div>
    <div class="elevationMeasurementUnits">
        <label>Distance Unit:</label><br/>
        <select style="width:100%;" data-dojo-attach-point="stackedUnitsSelect" data-dojo-type="dijit/form/Select" id="stackedUnitsSelect" data-dojo-attach-event="onChange:onUnitChange">
            <option value="Miles">Miles</option>
            <option value="Kilometers">Kilometers</option>
            <option value="Meters">Meters</option>
            <option value="Feet">Feet</option>
        </select>
    </div>
    <div>
        <label>Digitize a route:</label><br>
        <button data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'draw-icon-polyline fa fa-fw',showLabel:false,disabled:false" data-dojo-attach-point="btnPolyline" data-dojo-attach-event="click:onPolyline" title="Draw Polyline"></button>
        <button data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'draw-icon-freehand-polyline fa fa-fw',showLabel:false,disabled:false" data-dojo-attach-point="btnFreehandPolyline" data-dojo-attach-event="click:onFreehandPolyline" title="Draw Freehand Polyline"></button>
        <button style="margin-left:20px;" data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'fa fa-times fa-fw',showLabel:false,disabled:true" data-dojo-attach-point="stackedBtnClear" data-dojo-attach-event="click:onClear" title="Clear Drawing"></button>
    </div>

</div>

//CSS (i.e.viewer\js\gis\dijit\SubsurfaceProfile\css\SubsurfaceProfile.css):

.cmvStackedProfileWidget .elevationMeasurementUnits {
    float: right;
    height: 100px;
    margin-left: 20px;
    width: 150px;
}

.cmvStackedProfileWidget label {
    margin-left: 5px;
}

.dijitTabPaneWrapper{
    overflow-y: auto; 
    overflow-x: auto;
 }

.stackedOverlayNode {
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

#stackedChartNode {
    height: calc(90% - 20px) !important;
    left: 1px;
    min-height: 150px !important;
    position: relative;
    top: 1px;
    width: calc(100% - 5px) !important;
    overflow: visible;
    bottom: 2px; 
} 

.stackedLoadingOverlay {
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