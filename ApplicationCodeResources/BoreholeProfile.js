// CMV \viewer\js\gis\dijit\BoreholeProfile - Overview
// Code refined to show key functionality

define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    'dojox/charting/Chart',
    'dojox/charting/Theme',
    'dojox/gfx/gradutils',

    'dojox/charting/action2d/Tooltip',

    'dojo/dom-class',
    'dojo/dom-construct',

    'dojo/topic',
    'dojo/aspect',
    'dojo/_base/lang',
    'dijit/registry',
    'dijit/layout/ContentPane',

    'esri/toolbars/draw',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/tasks/Geoprocessor',
    'esri/tasks/FeatureSet',
    'esri/graphic',

    'dojo/text!./Borehole/templates/Borehole.html',

    'dijit/form/Select',
    'dijit/form/Button',

    'xstyle/css!./Borehole/css/Borehole.css',
    'xstyle/css!./Borehole/css/Draw.css'

], function (
    declare,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,

    Chart,
    Theme,
    gradient,
    Tooltip,
    domClass,
    domConstruct,
    topic,
    aspect,
    lang,
    registry,
    ContentPane,

    Draw,
    SimpleMarkerSymbol,
    Geoprocessor,
    FeatureSet,
    Graphic,

    template
    
) {

        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: template,
            baseClass: 'cmvBoreholeWidget',

            toolbar: null,
            // epWidget: null,
            markerSymbol: null,
            measureUnit: null,
            pane: null,
            gp: null,
            currentPoint: null,

            title: 'Borehole Profile',
            nodeID: 'boreholeChartNode',
            
            boreholeOverlayNode: domConstruct.create('boreholeOverlayNode'),
            attributesContainerID: 'attributesContainerBorehole',
            dijitTooltipContainer: 'dijitTooltipContainer' ,

            //config options
            ProfileServiceURL: "",
            XField: "",
            ZField: "",
            SourceField: "",
            SurfaceElevationProfile: "",
            BedrockElevationProfile: "",

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

            postCreate: function () {
                this.inherited(arguments);

                if (this.parentWidget) {
                    if (this.parentWidget.toggleable) {
                        this.own(aspect.after(this.parentWidget, 'toggle', lang.hitch(this, function () {
                            this.onLayoutChange(this.parentWidget.open);
                        })));
                    }
                }


                this.markerSymbol = new SimpleMarkerSymbol({
                    "type": "esriSMS",
                    "style": "esriSMSCross",
                    "angle": -45,
                    "size": 20,
                    "outline": {"color":[0,0,0],"width":3,"type":"esriSLS","style":"esriSLSSolid"} 
                }); 
                this.point = this.markerSymbol; 
                this.gp = new Geoprocessor(this.BoreholeProfileServiceURL);
                this.gp.setOutSpatialReference({ "wkid": this.map.spatialReference.wkid });

                this.own(topic.subscribe('mapClickMode/currentSet', lang.hitch(this, 'setMapClickMode')));
            },

            initElevation: function () {
                if (!this.tableWidget) {
                    this.tableWidget = registry.byId(this.attributesContainerID + '_widget');
                }

                if (!this.tableWidget) {
                    topic.publish('viewer/handleError', {
                        error: 'Borehole Profile: The Attributes Table widget could not be found or created.'
                    });
                    return;
                }

                //open the right pane
                topic.publish(this.attributesContainerID + '/openPane');

                var tabs = null;

                if (!this.pane) {
                    this.pane = new ContentPane({
                        title: this.title,
                        closable: false,
                        floating: true,

                        content: '<div id="' + this.nodeID + '"></div>',

                        });
                    tabs = this.tableWidget.tabContainer;
                    tabs.addChild(this.pane);
                    this.pane.resize()
                }


                if (!this.chart) {
                    gradient = Theme.generateGradient;
                    defaultFill = { type: "linear", space: "shape", x1: 0, y1: 0, x2: 0, y2: 100 };
                    let customTheme = new Theme({ //customTheme = Sky gradient
                        chart: {
                            fill: '#fff', //white
                            stroke: {
                                color: '#fff' //white
                            },
                        },

                        plotarea: {
                            fill: gradient(defaultFill,'#69adfe','#99ccff') //sky color gradient

                        },
                        markers: {
                            SQUARE: "m-3,-3 l0,6 6,0 0,-6 z",
                        }
                    });

                    this.chart = new Chart(this.nodeID);
                    this.chart.setTheme(customTheme);
                    
                    // /// Shale plot:
                    if (!!this.ShaleFormations) {
                        this.chart.addPlot("shalePlot", {markers: true, animate: false, labels: false, labelStyle: "inside", labelOffset: 0 });
                        
                        new Tooltip(this.chart, "shalePlot", {
                            font: "normal normal bold 5pt Tahoma",
                            defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],

                            text: function(o){
                                return o.run.name + " Shale";
                            }
                        }); 
                        
                    }
                    
                    /// Salt plot:
                    if (!!this.SaltFormations) {
                        this.chart.addPlot("saltPlot", {markers: true, animate: false, labels: false, labelStyle: "inside", labelOffset: 0 });

                        new Tooltip(this.chart, "saltPlot", {
                            font: "normal normal bold 5pt Tahoma",
                            defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],

                            text: function(o){
                                return o.run.name + " Salt";
                            }
                        });
                    }

                    //// Bedrock Plot:
                    if (!!this.BedrockElevationProfile) {
                        this.chart.addPlot("bedrockPlot", { type: "Areas", vAxis: "y", markers: true, animate: false });

                        new Tooltip(this.chart, "bedrockPlot", {
                            font: "normal normal bold 20pt Tahoma",
                            defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],
                            text: function(o){
    
                                return "Crystalline Basement"
                                
                            }
                        });
                    };

                    /// Surface Elevation Plot:
                    if (!!this.SurfaceElevationProfile) {
                        this.chart.addPlot("surfacePlot", { type: "Areas", vAxis: "y", markers: true, animate: false });

                        new Tooltip(this.chart, "surfacePlot", {
                            defaultPosition: ["before-centered", "below-centered","above-centered","after-centered"],

                             text: function(o){
                                return "Surface" 
                            } 
                        }); 
                    };


                    this.chart.addAxis("y", 
                    {
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


                }
                else {

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
                }
   
                
                if (!this.toolbar) {
                    this.toolbar = new Draw(this.map);
                    this.toolbar.on('draw-end', lang.hitch(this, 'addGraphic'));
                    this.toolbar.on('draw-end', lang.hitch(this, 'submitJob'));

                }

                tabs = this.tableWidget.tabContainer;
                tabs.selectChild(this.pane);

                this.boreholeBtnClear.set('disabled', false);
                this.map.graphics.clear();
                this.map.disableMapNavigation();
                this.disconnectMapClick();

                this.chart.render();
                this.chart.resize(150,'_')
                   
            },

            submitJob: function (evt) {
                this.currGraphic = new Graphic(evt.geometry);
                myFeatureSet = new FeatureSet();
                myFeatureSet.features = [this.currGraphic];
                this.gp.submitJob(
                    { SamplePoint: myFeatureSet },
                    lang.hitch(this, 'stackCompleteCallback'),
                );
                dojo.place(this.boreholeOverlayNode, this.nodeID, "before");

                domClass.add(this.boreholeOverlayNode, "boreholeLoadingOverlay")
            },

            stackCompleteCallback: function (jobInfo) {
                this.gp.getResultData(
                    jobInfo.jobId,
                    'FinalTable',
                    lang.hitch(this, 'dataCallback'),
                    lang.hitch(this, 'dataErrback')
                );
                domClass.remove(this.boreholeOverlayNode,"boreholeLoadingOverlay")

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
                            chartData[f[this.SourceField]].push(f);
                            chartData[f[this.SourceField]].push(lang.clone(f));
                            let dat = chartData[f[this.SourceField]][1];
                            dat.x = dat.x + 1;
                        }
                    }
                 
                console.log("chartData: ",chartData)    
                }

                //if a surface elevation layer is specified, add it to its own plot
                if (!!this.SurfaceElevationProfile && chartData[this.SurfaceElevationProfile]) {
                    let surfaceData = chartData[this.SurfaceElevationProfile];

                    this.chart.addSeries(this.SurfaceElevationProfile, surfaceData, {

                        plot: "surfacePlot", stroke: { color: "#DEB887" },

                        fill: gradient(defaultFill, '#d1b59a', '#996532'),
                        stroke: { width: 9, color: '#ad8f70' },
                        

                    });
 
                             
                    delete chartData[this.SurfaceElevationProfile];
                }
                //if a bedrock elevation layer is specified, add it to its own plot
                if (!!this.BedrockElevationProfile && chartData[this.BedrockElevationProfile]) {
                    let bedrockData = chartData[this.BedrockElevationProfile];

                    
                    this.chart.addSeries(this.BedrockElevationProfile, bedrockData, {

                        plot: "bedrockPlot", stroke: { color: "#DEB887" },

                        fill: gradient(defaultFill,'#b8a89e','#79685a'),
                        stroke: { width: 9, color: '#56493c' },  /// color here line color drawn on chart
                         
                    });      
                    

                    delete chartData[this.BedrockElevationProfile];
                }
                

                ////////// if a shale layer is specified, add it to shale plot:
                if (!!this.AtrimShale && chartData[this.AtrimShale]) {
                    let atrimShalePlotData = chartData[this.AtrimShale];

                    this.chart.addSeries("Atrium", atrimShalePlotData, {

                        plot: "shalePlot", stroke: { color: "#5B8381" },
                        stroke: { width: 9, color: '#5B8381' },  /// color here line color drawn on chart
                         
                    });      
                    

                    delete chartData[this.AtrimShale];
                }  
                
                if (!!this.BakkenShale && chartData[this.BakkenShale]) {
                    let bakkenShalePlotData = chartData[this.BakkenShale];

                    this.chart.addSeries("Bakken", bakkenShalePlotData, {

                        plot: "shalePlot", stroke: { color: "#5B8381" },
                        stroke: { width: 9, color: '#5B8381' },  /// color here line color drawn on chart
                         
                    });      
                    
                    delete chartData[this.BakkenShale];
                }  
                
				// ...add other shale formations as needed
                
                //// Add salts series -- if a salt layer is specified, add it to salt plot
				if (!!this.LowerClearForkSalt && chartData[this.LowerClearForkSalt]) {
                    let lowerClearForkSaltPlotData = chartData[this.LowerClearForkSalt];

                    this.chart.addSeries("Lower Clear Fork" , lowerClearForkSaltPlotData, {

                        plot: "saltPlot", stroke: { color: "#D3BCD2" },

                        stroke: { width: 9, color: '#D3BCD2' },  /// color here line color drawn on chart
                         
                    });      

                    delete chartData[this.LowerClearForkSalt];
                }
                if (!!this.NewHutchinsonSalt && chartData[this.NewHutchinsonSalt]) {
                    let newHutchinsonSaltPlotData = chartData[this.NewHutchinsonSalt];

                    this.chart.addSeries("New Hutchinson" , newHutchinsonSaltPlotData, {

                        plot: "saltPlot", stroke: { color: "#D3BCD2" },

                        stroke: { width: 9, color: '#D3BCD2' },  /// color here line color drawn on chart
                         
                    });      
                    

                    delete chartData[this.NewHutchinsonSalt];
                }     
                // ...add other salt deposits as needed
				
                this.chart.render();
                this.chart.resize(150,'_')

            },

            dataErrback: function (err) {
                console.error("BoreholeProfile data error: ", err);
            },

            getFeatureAttributes(feature) {
                feature.attributes.x = feature.attributes[this.XField];
                feature.attributes.y = feature.attributes[this.ZField];
                return feature.attributes;
            },


            addGraphic: function (evt) {
                this.currentPoint = evt.geometry;
                this.toolbar.deactivate();
                this.connectMapClick();
                this.map.enableMapNavigation();
                var symbol = this.markerSymbol;
                this.map.graphics.add(new Graphic(evt.geometry, symbol));

                this.boreholeBtnClear.set('disabled', false);
            },

            onUnitChange: function (newValue) {
                this.measureUnit = newValue.toString();
            },

            onPoint: function () {
                this.initElevation();
                this.toolbar.activate('point');
            },



            onClear: function () {
                if (this.toolbar) {
                    this.toolbar.deactivate();
                }

                this.map.graphics.clear();
                this.boreholeBtnClear.set('disabled', false);
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

// configurations provided in: \viewer\js\config\Borehole.js:

define([], function () {
    return {
        map: true,
        mapClickMode: true,
        ProfileServiceURL: '<geoprocessing service url>'
       

        XField: "X",
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
    
    };
})

//HTML:

<div>
    <div>
        <label>Place borehole point:</label><br>
        <button data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'draw-icon-point fa fa-fw',showLabel:false,disabled:false" data-dojo-attach-point="btnPoint" data-dojo-attach-event="click:onPoint" title="Place Point"></button>
        
        <button style="margin-left:20px;" data-dojo-type="dijit/form/Button" data-dojo-props="iconClass:'fa fa-times fa-fw',showLabel:false,disabled:true" data-dojo-attach-point="boreholeBtnClear" data-dojo-attach-event="click:onClear" title="Clear Point"></button>
    </div>
</div>
  
//CSS:
.cmvBoreholeWidget .elevationMeasurementUnits {
    float: right;
    height: 100px;
    margin-left: 20px;
    width: 150px;
}

.cmvBoreholeWidget label {
    margin-left: 5px;
}

.boreholeProfile,
.attributesContainerBorehole{

    position: absolute;
    height: 100%;
    width: 100%;
    top: 0;
    left: 0;
    right: 0;
    z-index: -1;
    object-fit: cover;
}

.dijitTabPaneWrapper{
   overflow-y: auto 
}

.boreholeOverlayNode {
    height: calc(95% - 30px);
    min-height: 150px ;
    position: relative;
    top: 0;
    width: calc(100% - 10px);
    z-index: 1;
}

#boreholeChartNode {
    overflow-y: visible;
    overflow-x: visible;
    height: calc(95% - 30px) !important; 
    position: absolute;
    object-fit: cover;
    left: 50%;

    margin-right: auto; 
    transform: translate(-50%, 0);
    justify-content: center;
}

#boreholeChartNode>svg{
    overflow-x: visible;
    overflow-y: visible;
    justify-content: center;
}

.boreholeLoadingOverlay {
    
    position: absolute;
    background:  rgba(155, 208, 255, 0) url('https://js.arcgis.com/3.24compact/esri/dijit/images/loading-throb.gif') no-repeat center;
    z-index: 9;
    display: block;
    height: 90%; 
    width: 90%;
    justify-content: center;
    left: 50%;
    margin-right: auto; 
    transform: translate(-50%, 0);
} 

.dijitTooltipContainer {
    border: solid black 1px;
    background-color: red;
    color: black;
    font-size: small;
    }   
  