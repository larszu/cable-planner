-- Move codec devices from Networking to Codecs category
UPDATE templates SET category = 'Codecs', device_type = 'codec' WHERE device_type = 'av-over-ip' AND label LIKE '%Cisco%Codec%';
UPDATE templates SET category = 'Codecs', device_type = 'codec' WHERE device_type = 'av-over-ip' AND label LIKE '%Cisco%Room Kit%';
