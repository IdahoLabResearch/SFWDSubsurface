
import arcpy
from arcpy import env
from arcpy.sa import *
import pandas as pd
import numpy as np


import os
import time
import sys

arcpy.env.parallelProcessingFactor = "100%"

t0 = time.clock() 

# Set the environment:
arcpy.env.overwriteOutput = True

scriptPath = arcpy.GetParameter(0)
scriptPath = sys.path[0]


#Set variables for script:

StressFieldsUSA_WM = "StressFieldsUSA_WM"

SelectionPolygon = "SelectionPolygon"

SelectionPolygon = arcpy.GetParameter(1)


TableFromSelection = os.path.join("in_memory", "TableFromSelection")


# make vents and polygon feature layers:

arcpy.MakeFeatureLayer_management(StressFieldsUSA_WM,"StressFieldsFeatLyr")
arcpy.AddMessage("after make vents feat lyr: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

arcpy.MakeFeatureLayer_management(SelectionPolygon,"PolyFeatLyr")
arcpy.AddMessage("after make poly feat lyr: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

# Select vents with polygon:
arcpy.SelectLayerByLocation_management("StressFieldsFeatLyr","COMPLETELY_WITHIN","PolyFeatLyr")

arcpy.AddMessage("after selection: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

# Create table from selcted records:
arcpy.CopyRows_management ("StressFieldsFeatLyr", TableFromSelection)
arcpy.AddMessage("after create selection table: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

# table to data frame: 

##### credit: https://gist.github.com/d-wasserman/e9c98be1d0caebc2935afecf0ba239a0 #### 


def arcgis_table_to_dataframe(in_fc, input_fields, query="", skip_nulls=False, null_values=None):
    """Function will convert an arcgis table into a pandas dataframe with an object ID index, and the selected
    input fields. Uses TableToNumPyArray to get initial data.
    :param - in_fc - input feature class or table to convert
    :param - input_fields - fields to input into a da numpy converter function
    :param - query - sql like query to filter out records returned
    :param - skip_nulls - skip rows with null values
    :param - null_values - values to replace null values with.
    :returns - pandas dataframe"""
    OIDFieldName = arcpy.Describe(in_fc).OIDFieldName
    if input_fields:
        final_fields = [OIDFieldName] + input_fields
    else:
        final_fields = [field.name for field in arcpy.ListFields(in_fc)]
    np_array = arcpy.da.TableToNumPyArray(in_fc, final_fields, query, skip_nulls, null_values)
    object_id_index = np_array[OIDFieldName]
    fc_dataframe = pd.DataFrame(np_array, index=object_id_index, columns=input_fields)
    return fc_dataframe
	
fc_dataframe = arcgis_table_to_dataframe(TableFromSelection,['AZI'])	
	
arcpy.AddMessage("after converting selection table to data frame: Elapsed time: {0} seconds".format(int(time.clock() - t0)))
arcpy.AddMessage(fc_dataframe)

#dataframe to histogram array
	
## run numpy.histogram
##https://numpy.org/doc/stable/reference/generated/numpy.histogram.html ### Just return the array of bin counts  as final

AzimuthArray = fc_dataframe

# Creating histogram 
np.histogram(AzimuthArray, bins = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120,125,130,135,140,145,150,155,160,165,170,175,180,185,190,195,200,205,210,215,220,225,230,235,240,245,250,255,260,265,270,275,280,285,290,295,300,305,310,315,320,325,330,335,340,345,350,355,360]) 

hist, bins = np.histogram(AzimuthArray, bins = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120,125,130,135,140,145,150,155,160,165,170,175,180,185,190,195,200,205,210,215,220,225,230,235,240,245,250,255,260,265,270,275,280,285,290,295,300,305,310,315,320,325,330,335,340,345,350,355,360])   

arcpy.AddMessage(hist)

azimuthList = list(hist)
arcpy.AddMessage(azimuthList)

# return the hitogram array as the final array, make parameter: 

arcpy.AddMessage("after creating bins for rose diagram: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

arcpy.SetParameterAsText(2, azimuthList)










