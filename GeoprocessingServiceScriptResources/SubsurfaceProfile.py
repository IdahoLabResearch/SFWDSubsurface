
import arcpy
from arcpy import env
from arcpy.sa import *


import os
import time
import sys
arcpy.CheckOutExtension("Spatial")
arcpy.env.parallelProcessingFactor = "100%"

# Set the environment
t0 = time.clock() 

arcpy.env.overwriteOutput = True


scriptPath = arcpy.GetParameter(0)
scriptPath = sys.path[0]


######Set variables for script

profileschemaWM = "profileschemaWM"


SamplePoints = os.path.join("in_memory", "SamplePoints")


profileschemaWM = arcpy.GetParameter(1)


##### profileschemaWM to points
arcpy.Densify_edit(profileschemaWM, "Distance", "3000 Meters")

arcpy.AddMessage("after densify: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

arcpy.FeatureVerticesToPoints_management(profileschemaWM, SamplePoints)

arcpy.AddMessage("after FeatureVerticesToPoints: Elapsed time: {0} seconds".format(int(time.clock() - t0)))


####### formatting table 

arcpy.AddField_management(SamplePoints,"Distance","LONG")

arcpy.AddMessage("after add Distance field: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

arcpy.CalculateField_management(SamplePoints, "Distance", '!OBJECTID! * 3000 - 3000', "PYTHON")

arcpy.AddMessage("after calculate distance field: Elapsed time: {0} seconds".format(int(time.clock() - t0)))


######## DEMs 
dem1000m_WM = "dem1000m_WM"
intlwrclfkWMElevation = "intlwrclfkWMElevation"
intnewhutWMElevation = "intnewhutWMElevation"
BedrockDEM_WM = "BedrockDEM_WM"
# ...add additional raster layers or geophysical raster data as needed


RasterLayers = dem1000m_WM,intlwrclfkWMElevation,intnewhutWMElevation,BedrockDEM_WM


SampleTable_Transpose = os.path.join(arcpy.env.scratchGDB,"SampleTable_Transpose")


###### Extract Values to Points ######

arcpy.sa.ExtractMultiValuesToPoints(SamplePoints, RasterLayers)


arcpy.AddMessage("after EMVTP: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

###### Transpose #####

transpose_fields = "dem1000m_WM Surface;intlwrclfkWMElevation Lower_Clear_Fork;intnewhutWMElevation New_Hutchinson;BedrockDEM_WM Crystalline_Basement"

if arcpy.Exists(SampleTable_Transpose):
	arcpy.Delete_management(SampleTable_Transpose)


arcpy.TransposeFields_management(SamplePoints, transpose_fields, SampleTable_Transpose, "FormationName", "Elevation","Distance") 

arcpy.AddMessage("after transpose: Elapsed time: {0} seconds".format(int(time.clock() - t0)))
###############################################


FinalTable = os.path.join(arcpy.env.scratchGDB,"FinalTable")

Expression = "Elevation IS NOT NULL"
# delete final table if it already exists
if arcpy.Exists(FinalTable):
	arcpy.Delete_management(FinalTable)

fieldMappings = arcpy.FieldMappings()
fieldMappings.addTable(SampleTable_Transpose)

## Field mappings

for field in fieldMappings.fields:

	if field.name == "Elevation":
		IntFieldMap = arcpy.FieldMap()
		IntFieldMap.addInputField(SampleTable_Transpose,"Elevation") 
		IntField = IntFieldMap.outputField
		IntField.type = "SHORT" 
		IntFieldMap.outputField = IntField
		fieldMappings.replaceFieldMap(fieldMappings.findFieldMapIndex(field.name),IntFieldMap)
		
	
####### Table to Table

FinalTableWorkspace = os.path.join(arcpy.env.scratchGDB)

arcpy.TableToTable_conversion(SampleTable_Transpose, FinalTableWorkspace, "FinalTable", Expression, fieldMappings)

arcpy.AddMessage("after final table complete: Elapsed time: {0} seconds".format(int(time.clock() - t0)))

arcpy.SetParameter(2, FinalTable)








