# Release  history


 v 1.0.6 : - Fix compatibility issue with Splunk Cloud Platform
 v 1.0.3 : - ip_whitelist macro enhancement
 v 1.0.1 : - Fixing metadata, Splunk cloud compatibility review, and dashboard versions upgrade

# DESCRIPTION

This App was designed to collect, parse, normalize against CIM and visualize network traffic insight from your windows desktop or server local firewall activities.
This App contain configurations for data inputs and knowledge objects that enhance search capabilities and detection on your machine network without install any third party tools. It is also certified to ensure compliance with Common Information Model (CIM) standards.
    


# HOW TO INSTALL APP

1) Install the app in your indexers/search heads, 

2) Setup the app from the web ui setup wizard. specify the index you want to log your data, the country where you host the monitored machines with their geolocation latitude & longitude

2) Copie the inputs.conf file from the package default to all your forwarders collecting the windows firewall traffic log. Modify the index value according to your policy

3) Activate the firewall logging on the windows machines to be monitored.

 	How to do :
		  	- Press Windows + R to open the Run dialog.
			- Type wf.msc and press Enter. This opens the Windows Firewall with Advanced Security console.
			- In the console, right-click on Windows Defender Firewall with Advanced Security on Local Computer and select Properties.
			- Configure Logging for Each Profile tabs. We recommand to extend the limit size to at least 20MB


4) Enjoy your meal !!!


We provided an ip exclusion to help remove noise detection and false positive. feel free to enrich the lookup file whitelist_ip_ranges.csv .

You can make search using this request :   

					   index=* sourcetype="windows:pfirewall"
						
					   OR use the request below to optimize search and ignore legitimate IP

					   index IN `windows_pfirewall_index` sourcetype="windows:pfirewall" `ip_whitelist`
						
					   


## License

Refer to https://www.splunk.com/en_us/legal/splunk-general-terms.html for licensing terms
