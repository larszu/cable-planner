-- Add category column to templates
ALTER TABLE templates ADD COLUMN category TEXT;

-- Populate from existing deviceType→category mapping
UPDATE templates SET category = 'Sources' WHERE device_type IN ('camera','ptz-camera','graphics','computer','media-player');
UPDATE templates SET category = 'Peripherals' WHERE device_type IN ('mouse','keyboard');
UPDATE templates SET category = 'Switching' WHERE device_type IN ('switcher','router');
UPDATE templates SET category = 'Processing' WHERE device_type IN ('converter','scaler','adapter','frame-sync','multiviewer','capture-card');
UPDATE templates SET category = 'Distribution' WHERE device_type IN ('da','video-wall-controller');
UPDATE templates SET category = 'Monitoring' WHERE device_type IN ('monitor','tv');
UPDATE templates SET category = 'Projection' WHERE device_type IN ('projector');
UPDATE templates SET category = 'Recording' WHERE device_type IN ('recorder');
UPDATE templates SET category = 'Audio' WHERE device_type IN ('audio-mixer','audio-embedder','audio-interface','audio-dsp','stage-box','wireless-mic-receiver');
UPDATE templates SET category = 'Speakers & Amps' WHERE device_type IN ('speaker','amplifier');
UPDATE templates SET category = 'Networking' WHERE device_type IN ('ndi-encoder','ndi-decoder','network-switch','streaming-encoder','av-over-ip');
UPDATE templates SET category = 'KVM / Extenders' WHERE device_type IN ('kvm-extender','hdbaset-extender');
UPDATE templates SET category = 'Wireless' WHERE device_type IN ('wireless-video','intercom');
UPDATE templates SET category = 'LED Video' WHERE device_type IN ('led-processor');
UPDATE templates SET category = 'Media Servers' WHERE device_type IN ('media-server');
UPDATE templates SET category = 'Lighting' WHERE device_type IN ('lighting-console','moving-light','led-fixture','dmx-splitter');
UPDATE templates SET category = 'Control' WHERE device_type IN ('control-processor','tally-system','timecode-generator','midi-device');
UPDATE templates SET category = 'Cable Accessories' WHERE device_type IN ('cable-accessory');
UPDATE templates SET category = 'Infrastructure' WHERE device_type IN ('power-distribution');

-- Catch-all for any unmapped types
UPDATE templates SET category = 'Other' WHERE category IS NULL;
