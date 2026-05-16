-- Add reference_url to 26 branded templates missing it

-- Group A: Recently approved — URL known, ports already verified (6)
UPDATE templates SET reference_url = 'https://proav.roland.com/global/products/v-160hd/' WHERE id = 'b1a2c3d4-1601-4a00-b000-000000000001';
UPDATE templates SET reference_url = 'https://www.epiphan.com/products/pearl-2/' WHERE id = 'b1a2c3d4-1602-4a00-b000-000000000002';
UPDATE templates SET reference_url = 'https://proav.roland.com/global/products/v-80hd/' WHERE id = '99d5be88-f605-4f10-b3db-b923b8d5e8d3';
UPDATE templates SET reference_url = 'https://www.datavideo.com/global/product/DVK-400' WHERE id = 'b1a2c3d4-1603-4a00-b000-000000000003';
UPDATE templates SET reference_url = 'https://www.kiloview.com/en/products/ndi-sys/cube-x1/' WHERE id = 'b1a2c3d4-1604-4a00-b000-000000000004';
UPDATE templates SET reference_url = 'https://www.kiloview.com/en/products/ndi-sys/cube-r1/' WHERE id = 'b1a2c3d4-1605-4a00-b000-000000000005';

-- Group B: Community submissions — URL found + ports verified (11)
UPDATE templates SET reference_url = 'https://proav.roland.com/global/products/v-1hd_plus/' WHERE id = '87c9cdf7-1ce9-404b-956d-421a7562cd97';
UPDATE templates SET reference_url = 'https://proav.roland.com/global/products/v-1sdi/' WHERE id = 'e71c5b84-2f79-4ebd-8529-a150e130a66b';
UPDATE templates SET reference_url = 'https://proav.roland.com/global/products/v-8hd/' WHERE id = '28772c95-1640-4d52-aef0-458c228b2737';
UPDATE templates SET reference_url = 'https://birddog.tv/play-overview/' WHERE id = '0f85039b-069d-493b-a396-ddf9f199eeb9';
UPDATE templates SET reference_url = 'https://www.behringer.com/product.html?modelCode=0603-ACE' WHERE id = '8df5d42d-d964-43d1-8642-d19568684d7d';
UPDATE templates SET reference_url = 'https://www.behringer.com/product.html?modelCode=0603-AAB' WHERE id = 'f8690c0f-3ccd-44ff-a46a-909efa34d0df';
UPDATE templates SET reference_url = 'https://www.behringer.com/product.html?modelCode=0606-ABX' WHERE id = '7ebf7a37-cab2-43dd-a7ee-36b7331bda66';
UPDATE templates SET reference_url = 'https://www.behringer.com/product.html?modelCode=0606-ABV' WHERE id = '75bbd525-4675-43b2-bebb-486f5114671f';
UPDATE templates SET reference_url = 'https://zowietek.com/product/4k-video-streaming-encoder-decoder/' WHERE id = 'edf4efc3-e237-4430-91c9-71e775ce9d6b';
UPDATE templates SET reference_url = 'https://zowietek.com/product/sdi-ndi-video-streaming-encoder-decoder/' WHERE id = 'cecb3a54-2c77-4383-8d70-aba49fb3ea88';
UPDATE templates SET reference_url = 'https://zowietek.com/product/ptz-camera-keyboard-controller/' WHERE id = 'eee949ee-9c68-4d37-83c9-84eff034c842';

-- Group B port fix: ZowieBox 4K was missing HDMI OUT (loop/decode output)
UPDATE templates SET ports = '[{"id":"5ee5b684","label":"AUDIO IN","signalType":"analog-audio","direction":"input","connectorType":"trs-eighth","section":"Right"},{"id":"62255ac3","label":"HDMI IN","signalType":"hdmi","direction":"input","connectorType":"hdmi","section":"Right"},{"id":"170bbbd6","label":"Power","signalType":"power","direction":"input","connectorType":"usb-c","section":"Left"},{"id":"62876cc8","label":"USB","signalType":"usb","direction":"bidirectional","connectorType":"usb-a","section":"Right"},{"id":"9c0dcec5","label":"LAN POE","signalType":"ethernet","direction":"bidirectional","connectorType":"rj45","section":"Left"},{"id":"fc07dbef","label":"AUDIO OUT","signalType":"analog-audio","direction":"output","connectorType":"trs-eighth"},{"id":"hdmi-out-01","label":"HDMI OUT","signalType":"hdmi","direction":"output","connectorType":"hdmi"},{"id":"5c7fef25","label":"DC OUT","signalType":"power","direction":"output","connectorType":"barrel"}]' WHERE id = 'edf4efc3-e237-4430-91c9-71e775ce9d6b';

-- Group C: Codebase expansion cards (9)
UPDATE templates SET reference_url = 'https://www.analogway.com/products/four-displayport-1-2-input-card-for-livepremier-tm-series' WHERE id = 'aw-aql-in-dp';
UPDATE templates SET reference_url = 'https://www.analogway.com/products/four-12g-sdi-input-card-for-livepremier-tm-series' WHERE id = 'aw-aql-in-sdi';
UPDATE templates SET reference_url = 'https://www.analogway.com/products/four-12g-sdi-output-card-for-livepremier-tm-series' WHERE id = 'aw-aql-out-sdi';
UPDATE templates SET reference_url = 'https://usa.yamaha.com/products/proaudio/interfaces/digital_cards/index.html' WHERE id = 'yamaha-my8-ae';
UPDATE templates SET reference_url = 'https://usa.yamaha.com/products/proaudio/interfaces/digital_cards/index.html' WHERE id = 'yamaha-my16-ae';
UPDATE templates SET reference_url = 'https://usa.yamaha.com/products/proaudio/interfaces/my8-lake/index.html' WHERE id = 'yamaha-my8-lake';
UPDATE templates SET reference_url = 'https://usa.yamaha.com/products/proaudio/interfaces/dugan-my16/index.html' WHERE id = 'yamaha-dugan-my16';
UPDATE templates SET reference_url = 'https://digico.biz/dmi_cards/dmi-dante64/' WHERE id = 'digico-dmi-dante';
UPDATE templates SET reference_url = 'https://digico.biz/dmi_cards/dmi-madi-b/' WHERE id = 'digico-dmi-madi';
