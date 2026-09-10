-- tibo.fun — versioned Géographie content pack and trusted server RPCs

insert into private.content_packs (id, kind, slug, version, status, manifest, published_at)
values ('b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', 'geography', 'france-metropole', 1, 'published', '{"source":"https://geo.api.gouv.fr/","mapSource":"https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson","mapLicense":"Licence Ouverte / Etalab","populationYear":2023,"counts":{"easy":40,"medium":120,"hard":220},"checksum":"fe1dd38201b06395ae254ac12b5d51422651f3adadde70b5f887efff1b246dab"}'::jsonb, now())
on conflict (kind, slug, version) do nothing;

insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload)
values
  ('86e66045-8a60-5efd-a51e-28c18cd7b3ab', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06088', 'easy', 1, '{"inseeCode":"06088","name":"Nice","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.7032,"longitude":7.2528,"population":357737,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/06088?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('af481185-eb27-5946-b1f4-25fd1f082287', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13001', 'easy', 1, '{"inseeCode":"13001","name":"Aix-en-Provence","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.536,"longitude":5.3879,"population":149695,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/13001?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a798807c-df90-5931-99bc-bb95a3e06ec8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13055', 'easy', 1, '{"inseeCode":"13055","name":"Marseille","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.2803,"longitude":5.3806,"population":886040,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/13055?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5d3928a8-c906-5800-b06f-8b9c373bc332', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '14118', 'easy', 1, '{"inseeCode":"14118","name":"Caen","departmentCode":"14","departmentName":"Calvados","latitude":49.1846,"longitude":-0.3722,"population":109400,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/14118?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8e1dd74c-3737-5429-b4d6-f7ba0fc67ceb', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '21231', 'easy', 1, '{"inseeCode":"21231","name":"Dijon","departmentCode":"21","departmentName":"Côte-d''Or","latitude":47.3319,"longitude":5.0322,"population":161830,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/21231?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e1f0c3e5-eec8-5078-9aa9-3fdf7b85b6d0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '25056', 'easy', 1, '{"inseeCode":"25056","name":"Besançon","departmentCode":"25","departmentName":"Doubs","latitude":47.2602,"longitude":6.0123,"population":118489,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/25056?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f6e3df62-7aaa-5239-b672-1bf46bec2bd9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '29019', 'easy', 1, '{"inseeCode":"29019","name":"Brest","departmentCode":"29","departmentName":"Finistère","latitude":48.4085,"longitude":-4.4996,"population":142346,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/29019?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5d21f15c-9a1e-5db8-9030-8fb6443c78ee', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '30189', 'easy', 1, '{"inseeCode":"30189","name":"Nîmes","departmentCode":"30","departmentName":"Gard","latitude":43.8322,"longitude":4.3429,"population":151839,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/30189?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ffa75176-2d3f-57a1-a361-004aed597b68', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31555', 'easy', 1, '{"inseeCode":"31555","name":"Toulouse","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.6007,"longitude":1.4328,"population":514819,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/31555?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f903e3e3-8b38-5a4f-bc5c-5bc07d8779ef', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33063', 'easy', 1, '{"inseeCode":"33063","name":"Bordeaux","departmentCode":"33","departmentName":"Gironde","latitude":44.8624,"longitude":-0.5848,"population":267991,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/33063?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('934290ae-50dc-5869-a1a3-207b2d5d5225', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34172', 'easy', 1, '{"inseeCode":"34172","name":"Montpellier","departmentCode":"34","departmentName":"Hérault","latitude":43.61,"longitude":3.8742,"population":310240,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/34172?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6b39c455-1de9-5087-a33c-b9963bcf8946', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '35238', 'easy', 1, '{"inseeCode":"35238","name":"Rennes","departmentCode":"35","departmentName":"Ille-et-Vilaine","latitude":48.1159,"longitude":-1.6884,"population":230890,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/35238?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('344c68b4-a761-5691-ab38-851127f0eba6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '37261', 'easy', 1, '{"inseeCode":"37261","name":"Tours","departmentCode":"37","departmentName":"Indre-et-Loire","latitude":47.3943,"longitude":0.6949,"population":139259,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/37261?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('738be1ad-44a1-5cec-83a4-52d88f6afc21', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38185', 'easy', 1, '{"inseeCode":"38185","name":"Grenoble","departmentCode":"38","departmentName":"Isère","latitude":45.1842,"longitude":5.7155,"population":156140,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/38185?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('777c9bdd-f18d-5e77-93f0-c59dbf700cd5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '42218', 'easy', 1, '{"inseeCode":"42218","name":"Saint-Étienne","departmentCode":"42","departmentName":"Loire","latitude":45.4241,"longitude":4.3665,"population":173136,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/42218?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('87ea5c0d-ca28-559c-a979-633172355088', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44109', 'easy', 1, '{"inseeCode":"44109","name":"Nantes","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2382,"longitude":-1.5603,"population":327734,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/44109?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('eafed70c-2021-5335-8418-9a7de1316579', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '45234', 'easy', 1, '{"inseeCode":"45234","name":"Orléans","departmentCode":"45","departmentName":"Loiret","latitude":47.8734,"longitude":1.9122,"population":116357,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/45234?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8f682b51-52a7-568c-8c4c-2a1ea174eec0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '49007', 'easy', 1, '{"inseeCode":"49007","name":"Angers","departmentCode":"49","departmentName":"Maine-et-Loire","latitude":47.4819,"longitude":-0.5629,"population":159022,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/49007?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('40a1491f-7a4d-544f-847b-ea5984657931', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '51454', 'easy', 1, '{"inseeCode":"51454","name":"Reims","departmentCode":"51","departmentName":"Marne","latitude":49.2535,"longitude":4.0551,"population":177674,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/51454?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('4a354334-1ac8-5204-8287-fff3548a5022', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '54395', 'easy', 1, '{"inseeCode":"54395","name":"Nancy","departmentCode":"54","departmentName":"Meurthe-et-Moselle","latitude":48.6881,"longitude":6.1734,"population":103671,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/54395?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f4a4ac17-b30f-5bb9-884c-1dfd630f6863', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '57463', 'easy', 1, '{"inseeCode":"57463","name":"Metz","departmentCode":"57","departmentName":"Moselle","latitude":49.1048,"longitude":6.1962,"population":122572,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/57463?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('61c60ca0-f22c-5618-af82-4589e993b2e2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '59350', 'easy', 1, '{"inseeCode":"59350","name":"Lille","departmentCode":"59","departmentName":"Nord","latitude":50.6311,"longitude":3.0468,"population":238246,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/59350?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1766dfde-a8b7-58a9-b174-cf0d5562090c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '63113', 'easy', 1, '{"inseeCode":"63113","name":"Clermont-Ferrand","departmentCode":"63","departmentName":"Puy-de-Dôme","latitude":45.787,"longitude":3.1127,"population":146351,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/63113?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d109c912-65db-57cf-b56f-1b19274fd530', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '66136', 'easy', 1, '{"inseeCode":"66136","name":"Perpignan","departmentCode":"66","departmentName":"Pyrénées-Orientales","latitude":42.699,"longitude":2.9045,"population":121616,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/66136?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('36a3c28b-b0eb-59c6-9efb-22023b23e89c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '67482', 'easy', 1, '{"inseeCode":"67482","name":"Strasbourg","departmentCode":"67","departmentName":"Bas-Rhin","latitude":48.5691,"longitude":7.7621,"population":293771,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/67482?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d1142227-3e60-57ce-8f06-0c45a118cf2f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '68224', 'easy', 1, '{"inseeCode":"68224","name":"Mulhouse","departmentCode":"68","departmentName":"Haut-Rhin","latitude":47.7526,"longitude":7.3255,"population":104978,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/68224?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1eb777b6-0ecb-5371-bde8-6e899fe336d5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '69123', 'easy', 1, '{"inseeCode":"69123","name":"Lyon","departmentCode":"69","departmentName":"Rhône","latitude":45.758,"longitude":4.8351,"population":519127,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/69123?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6c90473e-80f3-50c2-bcfb-2cba79285e80', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '69266', 'easy', 1, '{"inseeCode":"69266","name":"Villeurbanne","departmentCode":"69","departmentName":"Rhône","latitude":45.7719,"longitude":4.8898,"population":163684,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/69266?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bd7d6c3e-5390-56dd-9229-d13c35d4b0fd', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '72181', 'easy', 1, '{"inseeCode":"72181","name":"Le Mans","departmentCode":"72","departmentName":"Sarthe","latitude":47.9819,"longitude":0.1957,"population":146249,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/72181?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ff7e0e90-67c2-50b0-9119-5a76ab7312ae', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '74010', 'easy', 1, '{"inseeCode":"74010","name":"Annecy","departmentCode":"74","departmentName":"Haute-Savoie","latitude":45.9024,"longitude":6.1264,"population":132117,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/74010?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('30f7f68e-e28a-50ae-bfcc-4c99ec838609', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '75056', 'easy', 1, '{"inseeCode":"75056","name":"Paris","departmentCode":"75","departmentName":"Paris","latitude":48.8589,"longitude":2.347,"population":2103778,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/75056?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b4805b80-b239-55e8-a8c7-1649a6ebfe5d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '76351', 'easy', 1, '{"inseeCode":"76351","name":"Le Havre","departmentCode":"76","departmentName":"Seine-Maritime","latitude":49.4958,"longitude":0.1312,"population":166687,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/76351?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('03c68ef5-8a2a-5363-877a-a796bfc279a6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '76540', 'easy', 1, '{"inseeCode":"76540","name":"Rouen","departmentCode":"76","departmentName":"Seine-Maritime","latitude":49.4412,"longitude":1.0912,"population":117662,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/76540?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('24da5584-3105-5b88-a1de-ab42a0fcc093', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '80021', 'easy', 1, '{"inseeCode":"80021","name":"Amiens","departmentCode":"80","departmentName":"Somme","latitude":49.8987,"longitude":2.2847,"population":136449,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/80021?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b045e37d-4155-5e86-a343-09cd2719ceef', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '83137', 'easy', 1, '{"inseeCode":"83137","name":"Toulon","departmentCode":"83","departmentName":"Var","latitude":43.1364,"longitude":5.9334,"population":179116,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/83137?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3ed3b21a-f4d2-5351-a731-e879e8a2da0a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '87085', 'easy', 1, '{"inseeCode":"87085","name":"Limoges","departmentCode":"87","departmentName":"Haute-Vienne","latitude":45.8567,"longitude":1.226,"population":129937,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/87085?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b4d9ad16-dffe-517b-8497-33e437e25343', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '92012', 'easy', 1, '{"inseeCode":"92012","name":"Boulogne-Billancourt","departmentCode":"92","departmentName":"Hauts-de-Seine","latitude":48.8375,"longitude":2.2429,"population":119019,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/92012?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3e80caf9-115b-5469-bbf5-e622868a1a4a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '93048', 'easy', 1, '{"inseeCode":"93048","name":"Montreuil","departmentCode":"93","departmentName":"Seine-Saint-Denis","latitude":48.8637,"longitude":2.4491,"population":111934,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/93048?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('625123ec-e2e3-51d2-bacd-1f290e1bd8a0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '93066', 'easy', 1, '{"inseeCode":"93066","name":"Saint-Denis","departmentCode":"93","departmentName":"Seine-Saint-Denis","latitude":48.9378,"longitude":2.3657,"population":149077,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/93066?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('07d7746d-63a0-5077-9c66-1a5e97dde00d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '95018', 'easy', 1, '{"inseeCode":"95018","name":"Argenteuil","departmentCode":"95","departmentName":"Val-d''Oise","latitude":48.9501,"longitude":2.2478,"population":106130,"populationYear":2023,"difficulty":"easy","sourceUrl":"https://geo.api.gouv.fr/communes/95018?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('aca9b6c2-4f66-5ad4-a8fc-c10a0dcb44cf', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01053', 'medium', 2, '{"inseeCode":"01053","name":"Bourg-en-Bresse","departmentCode":"01","departmentName":"Ain","latitude":46.2027,"longitude":5.2469,"population":42372,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/01053?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9cb1cc93-3801-55e8-a4cf-0fdcda3e16a7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01283', 'medium', 2, '{"inseeCode":"01283","name":"Oyonnax","departmentCode":"01","departmentName":"Ain","latitude":46.2599,"longitude":5.6517,"population":22480,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/01283?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e88f6df0-b719-524e-9543-a6cb38d49cf5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '02408', 'medium', 2, '{"inseeCode":"02408","name":"Laon","departmentCode":"02","departmentName":"Aisne","latitude":49.5711,"longitude":3.613,"population":24220,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/02408?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('160f2eed-ac39-5305-ac11-161aef6822ea', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '02691', 'medium', 2, '{"inseeCode":"02691","name":"Saint-Quentin","departmentCode":"02","departmentName":"Aisne","latitude":49.8475,"longitude":3.279,"population":52813,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/02691?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c5004d46-62c8-56ac-ba9e-de23b2ef6efa', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '02722', 'medium', 2, '{"inseeCode":"02722","name":"Soissons","departmentCode":"02","departmentName":"Aisne","latitude":49.3766,"longitude":3.3235,"population":28046,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/02722?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2a406daa-5de3-5e96-9ffd-e28e34248d7d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '03185', 'medium', 2, '{"inseeCode":"03185","name":"Montluçon","departmentCode":"03","departmentName":"Allier","latitude":46.3428,"longitude":2.608,"population":33147,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/03185?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('28dbef17-0e2e-5d06-9931-8a9f33a17b3d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '03310', 'medium', 2, '{"inseeCode":"03310","name":"Vichy","departmentCode":"03","departmentName":"Allier","latitude":46.1318,"longitude":3.4254,"population":25115,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/03310?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('982ce900-970e-51b0-a7a1-e1512f5c99f0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '04112', 'medium', 2, '{"inseeCode":"04112","name":"Manosque","departmentCode":"04","departmentName":"Alpes-de-Haute-Provence","latitude":43.8293,"longitude":5.7896,"population":22718,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/04112?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7832d11d-1485-5f8b-8e21-567c056158fb', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '05061', 'medium', 2, '{"inseeCode":"05061","name":"Gap","departmentCode":"05","departmentName":"Hautes-Alpes","latitude":44.5797,"longitude":6.0616,"population":41293,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/05061?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('acf2286e-211c-5217-9260-f1c7348bda02', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06004', 'medium', 2, '{"inseeCode":"06004","name":"Antibes","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.5823,"longitude":7.1048,"population":77637,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06004?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ec32d4e9-5b64-5546-9e99-df84c04d3abd', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06027', 'medium', 2, '{"inseeCode":"06027","name":"Cagnes-sur-Mer","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.6712,"longitude":7.1502,"population":53354,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06027?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6b61bec7-cf4a-519e-85fd-8247f71df006', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06029', 'medium', 2, '{"inseeCode":"06029","name":"Cannes","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.5454,"longitude":7.0152,"population":74350,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06029?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ed313d5a-7264-5fac-9815-8fa84b5a7e0e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06030', 'medium', 2, '{"inseeCode":"06030","name":"Le Cannet","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.5745,"longitude":7.001,"population":41938,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06030?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('00aab7a0-e031-50d1-b774-61c124eb0953', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06069', 'medium', 2, '{"inseeCode":"06069","name":"Grasse","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.656,"longitude":6.937,"population":50970,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06069?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3433fe99-7fba-505b-95e0-ee00eec0b754', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06079', 'medium', 2, '{"inseeCode":"06079","name":"Mandelieu-la-Napoule","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.5334,"longitude":6.918,"population":21640,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06079?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('449236b2-eab9-554b-bcd9-23a55297515a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06083', 'medium', 2, '{"inseeCode":"06083","name":"Menton","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.7961,"longitude":7.498,"population":30604,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06083?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1303a79d-776e-56de-8fcd-2c74d1f0c743', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06123', 'medium', 2, '{"inseeCode":"06123","name":"Saint-Laurent-du-Var","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.6865,"longitude":7.1822,"population":32172,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06123?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('56d3620b-0928-5d28-bfd1-9836fadf904a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '06155', 'medium', 2, '{"inseeCode":"06155","name":"Vallauris","departmentCode":"06","departmentName":"Alpes-Maritimes","latitude":43.5787,"longitude":7.0604,"population":29259,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/06155?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1ffb6dd8-90e0-50ba-b8d8-2f32d357b53b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '08105', 'medium', 2, '{"inseeCode":"08105","name":"Charleville-Mézières","departmentCode":"08","departmentName":"Ardennes","latitude":49.7802,"longitude":4.7304,"population":45560,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/08105?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a96a837e-3c20-519b-a243-5bbd3dbddd1a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '10387', 'medium', 2, '{"inseeCode":"10387","name":"Troyes","departmentCode":"10","departmentName":"Aube","latitude":48.2924,"longitude":4.0761,"population":62088,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/10387?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9a38b9f8-b3ef-5a59-99b2-01158c078259', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '11069', 'medium', 2, '{"inseeCode":"11069","name":"Carcassonne","departmentCode":"11","departmentName":"Aude","latitude":43.2078,"longitude":2.3491,"population":46080,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/11069?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('176379ba-5f43-503e-b0fe-832d56abb5c5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '11262', 'medium', 2, '{"inseeCode":"11262","name":"Narbonne","departmentCode":"11","departmentName":"Aude","latitude":43.1493,"longitude":3.0337,"population":57587,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/11262?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('904447dc-e594-567a-88c2-3b94a7b0e839', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '12145', 'medium', 2, '{"inseeCode":"12145","name":"Millau","departmentCode":"12","departmentName":"Aveyron","latitude":44.0982,"longitude":3.1176,"population":22044,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/12145?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('01715ddb-9128-53ce-bf03-009d82b7b351', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '12202', 'medium', 2, '{"inseeCode":"12202","name":"Rodez","departmentCode":"12","departmentName":"Aveyron","latitude":44.3591,"longitude":2.5699,"population":23981,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/12202?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('30ce8d34-2098-57ac-b90b-862ca291676d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13002', 'medium', 2, '{"inseeCode":"13002","name":"Allauch","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.3522,"longitude":5.5103,"population":21443,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13002?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9d0bfbbf-25f4-537f-8dcf-29e00bf57cb2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13004', 'medium', 2, '{"inseeCode":"13004","name":"Arles","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.5441,"longitude":4.6513,"population":51811,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13004?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a37c6709-0877-53f0-ae1b-5e8aaa93a931', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13005', 'medium', 2, '{"inseeCode":"13005","name":"Aubagne","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.2904,"longitude":5.5643,"population":47529,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13005?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a810590c-64ff-548d-829c-28b3c1356cc8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13028', 'medium', 2, '{"inseeCode":"13028","name":"La Ciotat","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.1882,"longitude":5.6175,"population":38477,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13028?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f9ec9882-cb3e-5d6f-b73a-77767e4ae1a9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13041', 'medium', 2, '{"inseeCode":"13041","name":"Gardanne","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.4585,"longitude":5.4857,"population":21597,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13041?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('312d2fe6-b3de-5039-829f-b09be9f909dc', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13047', 'medium', 2, '{"inseeCode":"13047","name":"Istres","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.5455,"longitude":4.9477,"population":44292,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13047?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('11b504b7-88c2-5c26-9e04-8a84c0d843b7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13054', 'medium', 2, '{"inseeCode":"13054","name":"Marignane","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.4218,"longitude":5.2178,"population":33692,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13054?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6d5521fa-95dc-5564-a953-780dc654a4b0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13056', 'medium', 2, '{"inseeCode":"13056","name":"Martigues","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.3839,"longitude":5.0451,"population":48298,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13056?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('98893b0f-c087-5105-a89a-67c529717d45', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13063', 'medium', 2, '{"inseeCode":"13063","name":"Miramas","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.5841,"longitude":5.0148,"population":26203,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13063?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c0206e87-faf8-507b-8e06-6c002662a398', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13071', 'medium', 2, '{"inseeCode":"13071","name":"Les Pennes-Mirabeau","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.4005,"longitude":5.3222,"population":22537,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13071?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('4552df53-6e6b-5b32-a836-f706c4768ce9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13103', 'medium', 2, '{"inseeCode":"13103","name":"Salon-de-Provence","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.643,"longitude":5.049,"population":44194,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13103?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e591a7e3-f7a9-55c8-9b09-143a88a3a638', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '13117', 'medium', 2, '{"inseeCode":"13117","name":"Vitrolles","departmentCode":"13","departmentName":"Bouches-du-Rhône","latitude":43.4509,"longitude":5.2656,"population":36758,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/13117?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a7fc9ca2-9c4e-5fe9-a912-13330f7d15e8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '14327', 'medium', 2, '{"inseeCode":"14327","name":"Hérouville-Saint-Clair","departmentCode":"14","departmentName":"Calvados","latitude":49.2042,"longitude":-0.3324,"population":23470,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/14327?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a383b879-cbd5-56d0-8bb7-d9663334ae41', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '15014', 'medium', 2, '{"inseeCode":"15014","name":"Aurillac","departmentCode":"15","departmentName":"Cantal","latitude":44.9281,"longitude":2.4416,"population":26214,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/15014?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5865f28b-8c77-5a77-b246-11d5c863c062', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '16015', 'medium', 2, '{"inseeCode":"16015","name":"Angoulême","departmentCode":"16","departmentName":"Charente","latitude":45.6458,"longitude":0.145,"population":41908,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/16015?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b7293dc9-9243-5a1f-ad3b-d10064e59e71', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '17299', 'medium', 2, '{"inseeCode":"17299","name":"Rochefort","departmentCode":"17","departmentName":"Charente-Maritime","latitude":45.9455,"longitude":-0.9745,"population":23460,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/17299?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('735a3860-26ca-5638-b325-2c64d8845628', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '17300', 'medium', 2, '{"inseeCode":"17300","name":"La Rochelle","departmentCode":"17","departmentName":"Charente-Maritime","latitude":46.162,"longitude":-1.1765,"population":79851,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/17300?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bf9e6b39-ede6-556b-a291-a1981a586dc3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '17415', 'medium', 2, '{"inseeCode":"17415","name":"Saintes","departmentCode":"17","departmentName":"Charente-Maritime","latitude":45.7462,"longitude":-0.6456,"population":25363,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/17415?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0c6afb7d-0d6d-5200-ac6e-a7e219d70ec3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '18033', 'medium', 2, '{"inseeCode":"18033","name":"Bourges","departmentCode":"18","departmentName":"Cher","latitude":47.078,"longitude":2.3983,"population":64186,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/18033?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('92e9205a-0719-56d2-a8c2-887f7b325aa1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '18279', 'medium', 2, '{"inseeCode":"18279","name":"Vierzon","departmentCode":"18","departmentName":"Cher","latitude":47.2351,"longitude":2.0776,"population":25068,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/18279?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('807fc692-a64d-55c3-b66c-dea905b54213', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '19031', 'medium', 2, '{"inseeCode":"19031","name":"Brive-la-Gaillarde","departmentCode":"19","departmentName":"Corrèze","latitude":45.145,"longitude":1.5144,"population":47095,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/19031?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7b0462f4-238f-565e-9b6d-85fe6564f7b4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '21054', 'medium', 2, '{"inseeCode":"21054","name":"Beaune","departmentCode":"21","departmentName":"Côte-d''Or","latitude":47.0272,"longitude":4.8421,"population":20352,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/21054?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e15e7ff3-b6a6-5c44-a592-8eafc5cd3ec1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '22113', 'medium', 2, '{"inseeCode":"22113","name":"Lannion","departmentCode":"22","departmentName":"Côtes-d''Armor","latitude":48.7454,"longitude":-3.4697,"population":20315,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/22113?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('38ee0f5a-3d3e-59ec-86c6-31d8de739471', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '22278', 'medium', 2, '{"inseeCode":"22278","name":"Saint-Brieuc","departmentCode":"22","departmentName":"Côtes-d''Armor","latitude":48.5108,"longitude":-2.7657,"population":44364,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/22278?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('34eca6d1-13df-5419-a6d0-ea0fc63d9c98', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '24037', 'medium', 2, '{"inseeCode":"24037","name":"Bergerac","departmentCode":"24","departmentName":"Dordogne","latitude":44.8519,"longitude":0.4883,"population":27110,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/24037?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('94b4e936-4c8a-59ab-b9f4-60597b52c15d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '24322', 'medium', 2, '{"inseeCode":"24322","name":"Périgueux","departmentCode":"24","departmentName":"Dordogne","latitude":45.1939,"longitude":0.7105,"population":29055,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/24322?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d57dc8da-8fda-5956-8808-f74a1f4c564d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '25388', 'medium', 2, '{"inseeCode":"25388","name":"Montbéliard","departmentCode":"25","departmentName":"Doubs","latitude":47.5168,"longitude":6.7834,"population":24672,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/25388?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('79e4363f-6626-51e2-a007-7324ef5b42a3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '26198', 'medium', 2, '{"inseeCode":"26198","name":"Montélimar","departmentCode":"26","departmentName":"Drôme","latitude":44.5545,"longitude":4.7454,"population":40595,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/26198?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('03af1b0c-dffe-5342-8ed8-f74c80260886', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '26281', 'medium', 2, '{"inseeCode":"26281","name":"Romans-sur-Isère","departmentCode":"26","departmentName":"Drôme","latitude":45.0611,"longitude":5.0477,"population":33464,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/26281?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('441b9752-fc5e-5f02-a38f-fa8e64131339', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '26362', 'medium', 2, '{"inseeCode":"26362","name":"Valence","departmentCode":"26","departmentName":"Drôme","latitude":44.9234,"longitude":4.9164,"population":64458,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/26362?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f463b499-60d6-529d-9873-7e457bd53d66', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '27229', 'medium', 2, '{"inseeCode":"27229","name":"Évreux","departmentCode":"27","departmentName":"Eure","latitude":49.018,"longitude":1.1406,"population":49360,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/27229?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fd85a2d5-5877-5bc1-b76f-199305cd6033', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '27681', 'medium', 2, '{"inseeCode":"27681","name":"Vernon","departmentCode":"27","departmentName":"Eure","latitude":49.0921,"longitude":1.4827,"population":25290,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/27681?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f4481955-23d0-5519-bd71-d790764f808f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '28085', 'medium', 2, '{"inseeCode":"28085","name":"Chartres","departmentCode":"28","departmentName":"Eure-et-Loir","latitude":48.4481,"longitude":1.5046,"population":38324,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/28085?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('60c82c3f-da9d-56d8-bbf5-b68c27ac6687', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '28134', 'medium', 2, '{"inseeCode":"28134","name":"Dreux","departmentCode":"28","departmentName":"Eure-et-Loir","latitude":48.7482,"longitude":1.3578,"population":31543,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/28134?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('aedc4157-886c-5f26-a81d-10e7b9b0f5f5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '29039', 'medium', 2, '{"inseeCode":"29039","name":"Concarneau","departmentCode":"29","departmentName":"Finistère","latitude":47.8977,"longitude":-3.8993,"population":20845,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/29039?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d7a30bf1-0e5b-53e1-afb9-af007052e608', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '29232', 'medium', 2, '{"inseeCode":"29232","name":"Quimper","departmentCode":"29","departmentName":"Finistère","latitude":47.9982,"longitude":-4.0972,"population":64385,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/29232?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ddf1ec1e-44ee-5408-bc36-e83ab80c06ff', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '2A004', 'medium', 2, '{"inseeCode":"2A004","name":"Ajaccio","departmentCode":"2A","departmentName":"Corse-du-Sud","latitude":41.9228,"longitude":8.7058,"population":76320,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/2A004?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3715a5ca-1b9a-5f71-832c-7ee1142238db', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '2B033', 'medium', 2, '{"inseeCode":"2B033","name":"Bastia","departmentCode":"2B","departmentName":"Haute-Corse","latitude":42.6861,"longitude":9.424,"population":46867,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/2B033?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('dce49ab8-1055-564c-8cd7-0f59ef0925c9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '30007', 'medium', 2, '{"inseeCode":"30007","name":"Alès","departmentCode":"30","departmentName":"Gard","latitude":44.125,"longitude":4.0905,"population":46125,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/30007?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a8b2a290-5e7e-58c4-89c3-e9ab9ee15468', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31069', 'medium', 2, '{"inseeCode":"31069","name":"Blagnac","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.641,"longitude":1.377,"population":27604,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/31069?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('96c75603-3849-54df-8bf0-2666d2f90d4a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31149', 'medium', 2, '{"inseeCode":"31149","name":"Colomiers","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.6116,"longitude":1.3245,"population":40882,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/31149?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e8ad62ff-fbf3-5e64-a005-980d8c1511d3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31157', 'medium', 2, '{"inseeCode":"31157","name":"Cugnaux","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.5446,"longitude":1.3432,"population":20662,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/31157?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0e4e6b7a-8c28-573b-b4c9-d10379ed7694', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31395', 'medium', 2, '{"inseeCode":"31395","name":"Muret","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.4407,"longitude":1.2987,"population":26079,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/31395?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b36a2f12-9b50-5e88-90a7-0a23dc280553', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31424', 'medium', 2, '{"inseeCode":"31424","name":"Plaisance-du-Touch","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.5626,"longitude":1.2833,"population":21079,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/31424?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e4b0cafc-a7cf-5dc9-a3e4-38e2406226cd', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '31557', 'medium', 2, '{"inseeCode":"31557","name":"Tournefeuille","departmentCode":"31","departmentName":"Haute-Garonne","latitude":43.5747,"longitude":1.3338,"population":30168,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/31557?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('30261fe3-9db7-50d7-a021-f162e305e4e3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '32013', 'medium', 2, '{"inseeCode":"32013","name":"Auch","departmentCode":"32","departmentName":"Gers","latitude":43.6602,"longitude":0.5673,"population":22428,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/32013?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0530155e-7238-5d70-a85b-c39f9cebcffb', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33039', 'medium', 2, '{"inseeCode":"33039","name":"Bègles","departmentCode":"33","departmentName":"Gironde","latitude":44.803,"longitude":-0.5485,"population":31831,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33039?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('09021512-116f-5015-bd1e-fe8a8c336f53', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33069', 'medium', 2, '{"inseeCode":"33069","name":"Le Bouscat","departmentCode":"33","departmentName":"Gironde","latitude":44.865,"longitude":-0.6033,"population":25081,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33069?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d7c31da6-1ca6-54a7-b34e-4ac35da2c4c6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33075', 'medium', 2, '{"inseeCode":"33075","name":"Bruges","departmentCode":"33","departmentName":"Gironde","latitude":44.8893,"longitude":-0.6029,"population":20020,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33075?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a9ade8bf-8b07-5085-90e7-5d42645bbd62', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33119', 'medium', 2, '{"inseeCode":"33119","name":"Cenon","departmentCode":"33","departmentName":"Gironde","latitude":44.8552,"longitude":-0.5223,"population":26834,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33119?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cdc4130c-af57-503f-8d9b-e739b17099d7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33162', 'medium', 2, '{"inseeCode":"33162","name":"Eysines","departmentCode":"33","departmentName":"Gironde","latitude":44.8779,"longitude":-0.646,"population":24825,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33162?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('de4efca5-3882-5b97-b6cc-ee0414600fec', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33192', 'medium', 2, '{"inseeCode":"33192","name":"Gradignan","departmentCode":"33","departmentName":"Gironde","latitude":44.7681,"longitude":-0.6163,"population":26952,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33192?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3afddb70-dce9-5579-86b0-170ce1719b5a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33199', 'medium', 2, '{"inseeCode":"33199","name":"Gujan-Mestras","departmentCode":"33","departmentName":"Gironde","latitude":44.5758,"longitude":-1.0813,"population":22153,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33199?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('67908596-828e-5522-b467-6070b3e601a2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33243', 'medium', 2, '{"inseeCode":"33243","name":"Libourne","departmentCode":"33","departmentName":"Gironde","latitude":44.9125,"longitude":-0.2328,"population":25036,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33243?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6ecb1028-1633-523e-97c8-3cb85c8b9a8d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33249', 'medium', 2, '{"inseeCode":"33249","name":"Lormont","departmentCode":"33","departmentName":"Gironde","latitude":44.8749,"longitude":-0.5176,"population":25769,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33249?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9cb9b11b-fa59-5b30-ab74-1cb382651a91', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33281', 'medium', 2, '{"inseeCode":"33281","name":"Mérignac","departmentCode":"33","departmentName":"Gironde","latitude":44.8313,"longitude":-0.682,"population":78090,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33281?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('109a02a3-268f-50e4-9615-c72a0e39506c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33318', 'medium', 2, '{"inseeCode":"33318","name":"Pessac","departmentCode":"33","departmentName":"Gironde","latitude":44.786,"longitude":-0.681,"population":67339,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33318?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3f74e070-0804-5dd6-a628-8ce72ab7bad4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33449', 'medium', 2, '{"inseeCode":"33449","name":"Saint-Médard-en-Jalles","departmentCode":"33","departmentName":"Gironde","latitude":44.8861,"longitude":-0.7823,"population":32910,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33449?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('29a03c07-a076-5154-baad-e00e7ad59ab8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33522', 'medium', 2, '{"inseeCode":"33522","name":"Talence","departmentCode":"33","departmentName":"Gironde","latitude":44.8061,"longitude":-0.5918,"population":46338,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33522?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cf016e92-9cc3-5c61-825f-92acd880f6a6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33529', 'medium', 2, '{"inseeCode":"33529","name":"La Teste-de-Buch","departmentCode":"33","departmentName":"Gironde","latitude":44.586,"longitude":-1.1809,"population":27566,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33529?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('371e7740-f357-521d-a34e-81bf5f1d33a2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '33550', 'medium', 2, '{"inseeCode":"33550","name":"Villenave-d''Ornon","departmentCode":"33","departmentName":"Gironde","latitude":44.7736,"longitude":-0.5523,"population":42545,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/33550?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3fae404e-ed62-5e2d-b377-b2c1abf79f14', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34003', 'medium', 2, '{"inseeCode":"34003","name":"Agde","departmentCode":"34","departmentName":"Hérault","latitude":43.3084,"longitude":3.4838,"population":29939,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/34003?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f7653aa6-a310-5f9c-ab2f-8f9ade097c8f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34032', 'medium', 2, '{"inseeCode":"34032","name":"Béziers","departmentCode":"34","departmentName":"Hérault","latitude":43.3481,"longitude":3.2342,"population":81545,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/34032?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3377a19d-0adb-5e6d-b4cb-005ad3de28e6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34057', 'medium', 2, '{"inseeCode":"34057","name":"Castelnau-le-Lez","departmentCode":"34","departmentName":"Hérault","latitude":43.6372,"longitude":3.9113,"population":26058,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/34057?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3f831a91-b49c-5719-9be2-0d483a4da5ca', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34108', 'medium', 2, '{"inseeCode":"34108","name":"Frontignan","departmentCode":"34","departmentName":"Hérault","latitude":43.4486,"longitude":3.7493,"population":24136,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/34108?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7f6583e4-e623-510d-b0d8-3f906d54e57c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34145', 'medium', 2, '{"inseeCode":"34145","name":"Lunel","departmentCode":"34","departmentName":"Hérault","latitude":43.678,"longitude":4.1329,"population":26623,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/34145?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1aba76c8-12d2-5535-a538-29e6fa7de94d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '34301', 'medium', 2, '{"inseeCode":"34301","name":"Sète","departmentCode":"34","departmentName":"Hérault","latitude":43.3844,"longitude":3.6441,"population":45337,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/34301?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5c5def58-e331-5eb0-bc58-a5aeb083bdda', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '35115', 'medium', 2, '{"inseeCode":"35115","name":"Fougères","departmentCode":"35","departmentName":"Ille-et-Vilaine","latitude":48.3512,"longitude":-1.1953,"population":20307,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/35115?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('23fe8126-5d52-5893-83dc-870eac639cd4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '35288', 'medium', 2, '{"inseeCode":"35288","name":"Saint-Malo","departmentCode":"35","departmentName":"Ille-et-Vilaine","latitude":48.6465,"longitude":-2.0066,"population":47439,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/35288?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('99512c28-68f0-5f40-aa4e-dcca284dd2b8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '36044', 'medium', 2, '{"inseeCode":"36044","name":"Châteauroux","departmentCode":"36","departmentName":"Indre","latitude":46.8023,"longitude":1.6903,"population":42963,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/36044?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('36e683c4-3f52-598c-a290-35df5ad18f67', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '37122', 'medium', 2, '{"inseeCode":"37122","name":"Joué-lès-Tours","departmentCode":"37","departmentName":"Indre-et-Loire","latitude":47.3374,"longitude":0.6544,"population":38423,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/37122?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('72baf334-98d1-5474-a5e3-8d080f275c71', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38053', 'medium', 2, '{"inseeCode":"38053","name":"Bourgoin-Jallieu","departmentCode":"38","departmentName":"Isère","latitude":45.6025,"longitude":5.2747,"population":30151,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/38053?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('31070eec-286b-51c8-9805-eecccd287b14', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38151', 'medium', 2, '{"inseeCode":"38151","name":"Échirolles","departmentCode":"38","departmentName":"Isère","latitude":45.1441,"longitude":5.7148,"population":37491,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/38151?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a301dd8b-edd2-5af4-aeb3-9b68a5ea322b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38169', 'medium', 2, '{"inseeCode":"38169","name":"Fontaine","departmentCode":"38","departmentName":"Isère","latitude":45.194,"longitude":5.6763,"population":22020,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/38169?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d2c4feff-30aa-5cce-b037-7ae4551bcc38', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38421', 'medium', 2, '{"inseeCode":"38421","name":"Saint-Martin-d''Hères","departmentCode":"38","departmentName":"Isère","latitude":45.1782,"longitude":5.7646,"population":37695,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/38421?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f1b10579-8cbc-52ee-a62e-9b255d1ccf07', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38544', 'medium', 2, '{"inseeCode":"38544","name":"Vienne","departmentCode":"38","departmentName":"Isère","latitude":45.5221,"longitude":4.8803,"population":31778,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/38544?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d469be63-7082-51d2-9ecb-da8840625c6b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '38563', 'medium', 2, '{"inseeCode":"38563","name":"Voiron","departmentCode":"38","departmentName":"Isère","latitude":45.3805,"longitude":5.5869,"population":21847,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/38563?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('da803681-c93d-58da-8fea-a97b6dbce844', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '39198', 'medium', 2, '{"inseeCode":"39198","name":"Dole","departmentCode":"39","departmentName":"Jura","latitude":47.0739,"longitude":5.5024,"population":23840,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/39198?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8ed15c81-f427-520b-9c01-4efe4915716f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '40088', 'medium', 2, '{"inseeCode":"40088","name":"Dax","departmentCode":"40","departmentName":"Landes","latitude":43.7025,"longitude":-1.0637,"population":22109,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/40088?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('4c4efbeb-6faa-55bf-922d-4f380063cccd', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '40192', 'medium', 2, '{"inseeCode":"40192","name":"Mont-de-Marsan","departmentCode":"40","departmentName":"Landes","latitude":43.8931,"longitude":-0.5009,"population":31592,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/40192?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7a25f51b-d37c-5b6e-be6a-07859b9713c3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '41018', 'medium', 2, '{"inseeCode":"41018","name":"Blois","departmentCode":"41","departmentName":"Loir-et-Cher","latitude":47.5813,"longitude":1.3049,"population":47219,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/41018?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('711ac3e2-1732-5ff3-881d-618c72b858dd', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '42187', 'medium', 2, '{"inseeCode":"42187","name":"Roanne","departmentCode":"42","departmentName":"Loire","latitude":46.0443,"longitude":4.0797,"population":35409,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/42187?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7633fe76-43fa-5f9c-8a0b-618fbcbef82b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '42207', 'medium', 2, '{"inseeCode":"42207","name":"Saint-Chamond","departmentCode":"42","departmentName":"Loire","latitude":45.4687,"longitude":4.5082,"population":35646,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/42207?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7120a782-1b0f-5352-b34d-eda9e22939a5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44020', 'medium', 2, '{"inseeCode":"44020","name":"Bouguenais","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.171,"longitude":-1.6181,"population":20530,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44020?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1c2dbe6d-5963-5d78-b3c3-a0410b15b8ec', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44026', 'medium', 2, '{"inseeCode":"44026","name":"Carquefou","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2968,"longitude":-1.4687,"population":20921,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44026?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('66fbcbc0-945d-51b2-9c64-6cdcd3c0031f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44035', 'medium', 2, '{"inseeCode":"44035","name":"La Chapelle-sur-Erdre","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.3041,"longitude":-1.5621,"population":20690,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44035?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3134abb8-13e4-5f1f-8584-831e34a5f00c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44047', 'medium', 2, '{"inseeCode":"44047","name":"Couëron","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2391,"longitude":-1.7472,"population":24103,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44047?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e52ced2a-d260-5533-b297-1c3fffa9e483', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44114', 'medium', 2, '{"inseeCode":"44114","name":"Orvault","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2745,"longitude":-1.6195,"population":28534,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44114?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e3562b4d-c8a7-50d1-ab56-8b6891a9dc90', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44143', 'medium', 2, '{"inseeCode":"44143","name":"Rezé","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.1733,"longitude":-1.5573,"population":43556,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44143?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6b299fb9-f9a4-5c19-a11f-75e321e986bf', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44162', 'medium', 2, '{"inseeCode":"44162","name":"Saint-Herblain","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2246,"longitude":-1.6306,"population":50973,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44162?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3c617c5b-7109-5e6b-b972-97d305abe0db', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44184', 'medium', 2, '{"inseeCode":"44184","name":"Saint-Nazaire","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2768,"longitude":-2.2392,"population":74568,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44184?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('efc1a465-1423-5fa7-b677-bf083b807216', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44190', 'medium', 2, '{"inseeCode":"44190","name":"Saint-Sébastien-sur-Loire","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.2065,"longitude":-1.5023,"population":28596,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44190?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('25a238af-4ad0-5075-9cea-57ace99364c9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '44215', 'medium', 2, '{"inseeCode":"44215","name":"Vertou","departmentCode":"44","departmentName":"Loire-Atlantique","latitude":47.1532,"longitude":-1.4679,"population":26227,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/44215?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('63c5db01-6ffd-5f56-a9cd-024c59759bf2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '45147', 'medium', 2, '{"inseeCode":"45147","name":"Fleury-les-Aubrais","departmentCode":"45","departmentName":"Loiret","latitude":47.9449,"longitude":1.9223,"population":21804,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/45147?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d2ee5ef1-8ea2-5831-86f0-94e6a359ae18', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '45232', 'medium', 2, '{"inseeCode":"45232","name":"Olivet","departmentCode":"45","departmentName":"Loiret","latitude":47.8559,"longitude":1.8913,"population":23507,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/45232?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('91a2e0fc-be84-5cc5-8c90-8b8c2a896245', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '45284', 'medium', 2, '{"inseeCode":"45284","name":"Saint-Jean-de-Braye","departmentCode":"45","departmentName":"Loiret","latitude":47.9216,"longitude":1.9695,"population":23147,"populationYear":2023,"difficulty":"medium","sourceUrl":"https://geo.api.gouv.fr/communes/45284?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8d82ee2f-f1de-5cbc-a7c0-46109f040909', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01001', 'hard', 3, '{"inseeCode":"01001","name":"L''Abergement-Clémenciat","departmentCode":"01","departmentName":"Ain","latitude":46.1517,"longitude":4.9306,"population":860,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01001?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('056cbc34-7945-5624-9bed-76e8547b57e7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01002', 'hard', 3, '{"inseeCode":"01002","name":"L''Abergement-de-Varey","departmentCode":"01","departmentName":"Ain","latitude":46.0071,"longitude":5.4247,"population":270,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01002?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2bbee46a-9cbf-5eb1-9d00-97ed09ec5cb4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01004', 'hard', 3, '{"inseeCode":"01004","name":"Ambérieu-en-Bugey","departmentCode":"01","departmentName":"Ain","latitude":45.9575,"longitude":5.3706,"population":15934,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01004?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2f469948-7408-5d4f-96fa-78dd36e30abc', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01005', 'hard', 3, '{"inseeCode":"01005","name":"Ambérieux-en-Dombes","departmentCode":"01","departmentName":"Ain","latitude":45.9992,"longitude":4.9119,"population":1906,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01005?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c6184134-b94b-5201-8d61-738d7c5f909e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01006', 'hard', 3, '{"inseeCode":"01006","name":"Ambléon","departmentCode":"01","departmentName":"Ain","latitude":45.7483,"longitude":5.5928,"population":115,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01006?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c7074dcb-2ea3-56d6-a370-b49d152c356c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01007', 'hard', 3, '{"inseeCode":"01007","name":"Ambronay","departmentCode":"01","departmentName":"Ain","latitude":46.0099,"longitude":5.3627,"population":2841,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01007?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('447f5bed-4694-5fd7-9425-69c2fe1b255e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01008', 'hard', 3, '{"inseeCode":"01008","name":"Ambutrix","departmentCode":"01","departmentName":"Ain","latitude":45.9347,"longitude":5.3359,"population":760,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01008?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a59301c3-fd6d-5c47-aab5-07bde253b52f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01009', 'hard', 3, '{"inseeCode":"01009","name":"Andert-et-Condon","departmentCode":"01","departmentName":"Ain","latitude":45.7841,"longitude":5.6607,"population":348,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01009?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('df57ad86-a22f-5ebb-b180-5884ad40d158', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01010', 'hard', 3, '{"inseeCode":"01010","name":"Anglefort","departmentCode":"01","departmentName":"Ain","latitude":45.9086,"longitude":5.7948,"population":1174,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01010?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9f949a57-be2e-56a8-bf0e-1bdaa97f0bc4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01011', 'hard', 3, '{"inseeCode":"01011","name":"Apremont","departmentCode":"01","departmentName":"Ain","latitude":46.2045,"longitude":5.6619,"population":415,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01011?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('263e2279-31b9-5cb3-b2ca-da184c98baee', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01012', 'hard', 3, '{"inseeCode":"01012","name":"Aranc","departmentCode":"01","departmentName":"Ain","latitude":45.9972,"longitude":5.514,"population":331,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01012?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('63689725-b7cc-5327-8d94-22b50c2e9bc7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01013', 'hard', 3, '{"inseeCode":"01013","name":"Arandas","departmentCode":"01","departmentName":"Ain","latitude":45.8885,"longitude":5.4982,"population":138,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01013?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('28307f8d-b984-55c3-88d5-443d74999158', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01014', 'hard', 3, '{"inseeCode":"01014","name":"Arbent","departmentCode":"01","departmentName":"Ain","latitude":46.2838,"longitude":5.6879,"population":3555,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01014?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e5bff1ac-1a92-5327-b8e5-f4b043563e96', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01015', 'hard', 3, '{"inseeCode":"01015","name":"Arboys en Bugey","departmentCode":"01","departmentName":"Ain","latitude":45.7189,"longitude":5.6404,"population":710,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01015?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9e689fec-641d-5041-9b7e-6d1539d29658', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01016', 'hard', 3, '{"inseeCode":"01016","name":"Arbigny","departmentCode":"01","departmentName":"Ain","latitude":46.4808,"longitude":4.9613,"population":462,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01016?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b40dd608-932a-5e8a-b2d0-17320069f069', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01017', 'hard', 3, '{"inseeCode":"01017","name":"Argis","departmentCode":"01","departmentName":"Ain","latitude":45.9322,"longitude":5.4819,"population":419,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01017?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1ad6a2b3-dedf-591d-ac90-366199e13cb8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01019', 'hard', 3, '{"inseeCode":"01019","name":"Armix","departmentCode":"01","departmentName":"Ain","latitude":45.8523,"longitude":5.5837,"population":25,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01019?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a36ee0c8-c7f3-5b8e-bf34-de00964673b0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01021', 'hard', 3, '{"inseeCode":"01021","name":"Ars-sur-Formans","departmentCode":"01","departmentName":"Ain","latitude":45.9904,"longitude":4.8195,"population":1528,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01021?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f4204e8b-fc8b-5851-afc6-f26474db7af7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01022', 'hard', 3, '{"inseeCode":"01022","name":"Artemare","departmentCode":"01","departmentName":"Ain","latitude":45.8701,"longitude":5.692,"population":1139,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01022?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('806a8c36-215c-5999-a602-ebc0679003cc', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01023', 'hard', 3, '{"inseeCode":"01023","name":"Asnières-sur-Saône","departmentCode":"01","departmentName":"Ain","latitude":46.3859,"longitude":4.882,"population":78,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01023?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d154a41c-b774-50c7-9ad0-26793a46b305', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01024', 'hard', 3, '{"inseeCode":"01024","name":"Attignat","departmentCode":"01","departmentName":"Ain","latitude":46.2858,"longitude":5.1823,"population":3409,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01024?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('de988c51-ffce-5dc1-b6b0-08052d2023e0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01025', 'hard', 3, '{"inseeCode":"01025","name":"Bâgé-Dommartin","departmentCode":"01","departmentName":"Ain","latitude":46.3277,"longitude":4.9704,"population":4050,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01025?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8686c3b3-2353-55b7-91a4-f280387bb80f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01026', 'hard', 3, '{"inseeCode":"01026","name":"Bâgé-le-Châtel","departmentCode":"01","departmentName":"Ain","latitude":46.3081,"longitude":4.9305,"population":971,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01026?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c32efb4e-2280-5b7d-b2fe-992a6535b942', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01027', 'hard', 3, '{"inseeCode":"01027","name":"Balan","departmentCode":"01","departmentName":"Ain","latitude":45.8268,"longitude":5.1076,"population":3077,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01027?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a7388d0d-d2d4-5918-8f30-e0bb228e7803', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01028', 'hard', 3, '{"inseeCode":"01028","name":"Baneins","departmentCode":"01","departmentName":"Ain","latitude":46.1117,"longitude":4.9045,"population":621,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01028?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('aadb83d0-931c-5b49-aed7-8f185ebf302b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01029', 'hard', 3, '{"inseeCode":"01029","name":"Beaupont","departmentCode":"01","departmentName":"Ain","latitude":46.4274,"longitude":5.2634,"population":734,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01029?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('259f4050-3798-54d2-afc2-8ff964ec6c65', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01030', 'hard', 3, '{"inseeCode":"01030","name":"Beauregard","departmentCode":"01","departmentName":"Ain","latitude":46.0012,"longitude":4.7567,"population":872,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01030?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bb307dca-5f17-5577-9195-4ac900cddec9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01031', 'hard', 3, '{"inseeCode":"01031","name":"Bellignat","departmentCode":"01","departmentName":"Ain","latitude":46.2402,"longitude":5.6371,"population":3525,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01031?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('31415910-6912-5bd9-8c02-c79214654bb1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01032', 'hard', 3, '{"inseeCode":"01032","name":"Béligneux","departmentCode":"01","departmentName":"Ain","latitude":45.8622,"longitude":5.1415,"population":3535,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01032?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3e89bf95-45f6-59f0-9689-331f048510ca', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01033', 'hard', 3, '{"inseeCode":"01033","name":"Valserhône","departmentCode":"01","departmentName":"Ain","latitude":46.1234,"longitude":5.7944,"population":16712,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01033?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('00936cc3-4203-581c-8b73-bb46bc30641e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01034', 'hard', 3, '{"inseeCode":"01034","name":"Belley","departmentCode":"01","departmentName":"Ain","latitude":45.743,"longitude":5.6927,"population":9388,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01034?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9a49ac46-51ce-5b7f-92d8-16ab35fae56c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01035', 'hard', 3, '{"inseeCode":"01035","name":"Belleydoux","departmentCode":"01","departmentName":"Ain","latitude":46.2519,"longitude":5.7816,"population":306,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01035?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fd6a4e17-c931-5c98-99ab-620d1a7a8d84', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01036', 'hard', 3, '{"inseeCode":"01036","name":"Valromey-sur-Séran","departmentCode":"01","departmentName":"Ain","latitude":45.9236,"longitude":5.6626,"population":1351,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01036?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d60512b8-0307-5643-975a-5b0c5a1d31f0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01037', 'hard', 3, '{"inseeCode":"01037","name":"Bénonces","departmentCode":"01","departmentName":"Ain","latitude":45.842,"longitude":5.4834,"population":311,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01037?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('eb3ad105-cb11-5e25-8b23-a118fc8f0030', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01038', 'hard', 3, '{"inseeCode":"01038","name":"Bény","departmentCode":"01","departmentName":"Ain","latitude":46.3189,"longitude":5.2789,"population":777,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01038?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('575398ef-39a0-5e6d-8648-6646f49ca153', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01040', 'hard', 3, '{"inseeCode":"01040","name":"Béréziat","departmentCode":"01","departmentName":"Ain","latitude":46.3699,"longitude":5.0431,"population":475,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01040?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1b9458c3-aa78-52d6-8ac7-bfec37b99ac0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01041', 'hard', 3, '{"inseeCode":"01041","name":"Bettant","departmentCode":"01","departmentName":"Ain","latitude":45.9366,"longitude":5.3648,"population":774,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01041?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d92f4234-d3c6-53ba-b66c-e1c5cc0de74c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01042', 'hard', 3, '{"inseeCode":"01042","name":"Bey","departmentCode":"01","departmentName":"Ain","latitude":46.2182,"longitude":4.844,"population":286,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01042?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ecfde7ae-b13b-54bc-9724-8913939170f2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01043', 'hard', 3, '{"inseeCode":"01043","name":"Beynost","departmentCode":"01","departmentName":"Ain","latitude":45.8359,"longitude":4.9964,"population":5198,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01043?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c8e06a2d-2662-53f1-9a0e-5a2e8056b874', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01044', 'hard', 3, '{"inseeCode":"01044","name":"Billiat","departmentCode":"01","departmentName":"Ain","latitude":46.0778,"longitude":5.7632,"population":713,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01044?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('01f8dd4f-e892-5f40-ab29-db66310ea181', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01045', 'hard', 3, '{"inseeCode":"01045","name":"Birieux","departmentCode":"01","departmentName":"Ain","latitude":45.9509,"longitude":5.0401,"population":275,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01045?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('005f725d-4986-5f41-bbc4-643f38302e39', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01046', 'hard', 3, '{"inseeCode":"01046","name":"Biziat","departmentCode":"01","departmentName":"Ain","latitude":46.224,"longitude":4.9393,"population":889,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01046?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d091f262-326d-55d5-a929-89fef7e6c042', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01047', 'hard', 3, '{"inseeCode":"01047","name":"Blyes","departmentCode":"01","departmentName":"Ain","latitude":45.8442,"longitude":5.2515,"population":1401,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01047?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3fb037fe-d22b-517a-aa26-b81083e51dd2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01049', 'hard', 3, '{"inseeCode":"01049","name":"La Boisse","departmentCode":"01","departmentName":"Ain","latitude":45.8483,"longitude":5.0262,"population":3449,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01049?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('77943ecc-fa84-5666-bae5-6552c68756c8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01050', 'hard', 3, '{"inseeCode":"01050","name":"Boissey","departmentCode":"01","departmentName":"Ain","latitude":46.3723,"longitude":4.9975,"population":396,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01050?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8da2e421-b4ba-5bd5-97f4-e78b970d5f7b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01051', 'hard', 3, '{"inseeCode":"01051","name":"Bolozon","departmentCode":"01","departmentName":"Ain","latitude":46.1971,"longitude":5.4701,"population":103,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01051?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b1cd2679-9b8e-5325-9dab-25e7c21677b2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01052', 'hard', 3, '{"inseeCode":"01052","name":"Bouligneux","departmentCode":"01","departmentName":"Ain","latitude":46.0202,"longitude":4.9957,"population":318,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01052?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1a19e742-2c34-5d0e-9b6e-9ea83bec7316', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01054', 'hard', 3, '{"inseeCode":"01054","name":"Bourg-Saint-Christophe","departmentCode":"01","departmentName":"Ain","latitude":45.8842,"longitude":5.1393,"population":1562,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01054?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ec0b5a8f-ecdb-50b0-bf21-d88e80ac0740', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01056', 'hard', 3, '{"inseeCode":"01056","name":"Boyeux-Saint-Jérôme","departmentCode":"01","departmentName":"Ain","latitude":46.0356,"longitude":5.4616,"population":367,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01056?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bcb0a54f-9538-5bee-89ff-084d7c7c8d4d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01057', 'hard', 3, '{"inseeCode":"01057","name":"Boz","departmentCode":"01","departmentName":"Ain","latitude":46.4089,"longitude":4.9166,"population":513,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01057?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('743829c6-fa16-5799-aeb3-7abb87e7c4ba', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01058', 'hard', 3, '{"inseeCode":"01058","name":"Brégnier-Cordon","departmentCode":"01","departmentName":"Ain","latitude":45.6406,"longitude":5.6174,"population":804,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01058?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('52ffbc99-7302-5818-b29f-c634ad820d6a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01060', 'hard', 3, '{"inseeCode":"01060","name":"Brénod","departmentCode":"01","departmentName":"Ain","latitude":46.0791,"longitude":5.6116,"population":576,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01060?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('506d0669-8b85-5e26-b2d8-25c56feb4894', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01061', 'hard', 3, '{"inseeCode":"01061","name":"Brens","departmentCode":"01","departmentName":"Ain","latitude":45.7163,"longitude":5.69,"population":1123,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01061?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bb62ab6f-abd0-562b-aaac-3a41aace9445', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01062', 'hard', 3, '{"inseeCode":"01062","name":"Bressolles","departmentCode":"01","departmentName":"Ain","latitude":45.8714,"longitude":5.0984,"population":1028,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01062?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f2f5c137-ac25-5397-ad9d-981297c7ba26', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01063', 'hard', 3, '{"inseeCode":"01063","name":"Brion","departmentCode":"01","departmentName":"Ain","latitude":46.1689,"longitude":5.5477,"population":592,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01063?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f975e6e3-07b5-50e7-84c7-79343c6f701c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01064', 'hard', 3, '{"inseeCode":"01064","name":"Briord","departmentCode":"01","departmentName":"Ain","latitude":45.768,"longitude":5.4832,"population":1119,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01064?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d058e3bb-41c8-5efd-8c75-68bc2af7418a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01065', 'hard', 3, '{"inseeCode":"01065","name":"Buellas","departmentCode":"01","departmentName":"Ain","latitude":46.2116,"longitude":5.1468,"population":1899,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01065?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('4863832d-b31e-5f90-bf40-f66db22db182', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01066', 'hard', 3, '{"inseeCode":"01066","name":"La Burbanche","departmentCode":"01","departmentName":"Ain","latitude":45.8629,"longitude":5.548,"population":98,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01066?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('14607a1b-73eb-526f-b06b-7b56e591ca4e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01067', 'hard', 3, '{"inseeCode":"01067","name":"Ceignes","departmentCode":"01","departmentName":"Ain","latitude":46.1258,"longitude":5.4957,"population":257,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01067?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2b579433-6674-593e-bca4-653ef704248f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01068', 'hard', 3, '{"inseeCode":"01068","name":"Cerdon","departmentCode":"01","departmentName":"Ain","latitude":46.075,"longitude":5.4755,"population":747,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01068?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('24e634da-29ad-59b9-a292-53c6ed355ba8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01069', 'hard', 3, '{"inseeCode":"01069","name":"Certines","departmentCode":"01","departmentName":"Ain","latitude":46.1336,"longitude":5.2638,"population":1531,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01069?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('423f8c6f-3b0d-55d4-b83d-99d516cedfb2', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01071', 'hard', 3, '{"inseeCode":"01071","name":"Cessy","departmentCode":"01","departmentName":"Ain","latitude":46.3157,"longitude":6.082,"population":5832,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01071?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('80632826-c3bf-54a7-9036-e09d9c3a7173', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01072', 'hard', 3, '{"inseeCode":"01072","name":"Ceyzériat","departmentCode":"01","departmentName":"Ain","latitude":46.1822,"longitude":5.3191,"population":3328,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01072?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f9933ca2-0d65-5636-8261-f0466d9aa38a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01073', 'hard', 3, '{"inseeCode":"01073","name":"Ceyzérieu","departmentCode":"01","departmentName":"Ain","latitude":45.8368,"longitude":5.7197,"population":1064,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01073?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('61e3112b-287b-5462-9c9e-96ff3196cce7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01074', 'hard', 3, '{"inseeCode":"01074","name":"Chalamont","departmentCode":"01","departmentName":"Ain","latitude":46.0149,"longitude":5.1735,"population":2533,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01074?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('de61de3a-1052-5480-8358-9d348a347f8f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01075', 'hard', 3, '{"inseeCode":"01075","name":"Chaleins","departmentCode":"01","departmentName":"Ain","latitude":46.0361,"longitude":4.7999,"population":1505,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01075?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5345d462-b2ed-5856-8fa1-ac0cd851af0d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01076', 'hard', 3, '{"inseeCode":"01076","name":"Chaley","departmentCode":"01","departmentName":"Ain","latitude":45.9511,"longitude":5.5408,"population":129,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01076?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b5e3322e-4235-5bb4-be88-a61f53ec82dc', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01077', 'hard', 3, '{"inseeCode":"01077","name":"Challes-la-Montagne","departmentCode":"01","departmentName":"Ain","latitude":46.1237,"longitude":5.456,"population":184,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01077?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6ef1f46d-b523-53ac-83cb-54876256d532', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01078', 'hard', 3, '{"inseeCode":"01078","name":"Challex","departmentCode":"01","departmentName":"Ain","latitude":46.1765,"longitude":5.9735,"population":1632,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01078?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('61ec59de-87f3-5d9a-b439-ebf603a8aa9d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01079', 'hard', 3, '{"inseeCode":"01079","name":"Champagne-en-Valromey","departmentCode":"01","departmentName":"Ain","latitude":45.9317,"longitude":5.6921,"population":831,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01079?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7de69fc9-81db-530e-9c38-fa11162a1b93', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01080', 'hard', 3, '{"inseeCode":"01080","name":"Champdor-Corcelles","departmentCode":"01","departmentName":"Ain","latitude":46.0371,"longitude":5.5882,"population":665,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01080?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fe0e99b4-317e-5cdb-be69-0a63ccc2193b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01081', 'hard', 3, '{"inseeCode":"01081","name":"Champfromier","departmentCode":"01","departmentName":"Ain","latitude":46.2264,"longitude":5.8216,"population":725,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01081?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('98d54dad-8ad9-5309-a01b-ac8b97a9a7e0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01082', 'hard', 3, '{"inseeCode":"01082","name":"Chanay","departmentCode":"01","departmentName":"Ain","latitude":46.0024,"longitude":5.7674,"population":574,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01082?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('50d0b2c7-4205-5b1e-b143-64b2361bdfa4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01083', 'hard', 3, '{"inseeCode":"01083","name":"Chaneins","departmentCode":"01","departmentName":"Ain","latitude":46.0947,"longitude":4.8517,"population":1046,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01083?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2c1e8fa2-e43a-56aa-a089-e96315bd326d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01084', 'hard', 3, '{"inseeCode":"01084","name":"Chanoz-Châtenay","departmentCode":"01","departmentName":"Ain","latitude":46.1868,"longitude":5.0302,"population":989,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01084?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7953d1c1-5748-553d-aa1d-79e09662bcea', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01085', 'hard', 3, '{"inseeCode":"01085","name":"La Chapelle-du-Châtelard","departmentCode":"01","departmentName":"Ain","latitude":46.0683,"longitude":5.0174,"population":388,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01085?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('42128f6c-41e6-5c2e-baaa-6eff49b60926', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01087', 'hard', 3, '{"inseeCode":"01087","name":"Charix","departmentCode":"01","departmentName":"Ain","latitude":46.1893,"longitude":5.6773,"population":280,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01087?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8103c885-46bf-5ca1-a12e-4b1b3742a6f1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01088', 'hard', 3, '{"inseeCode":"01088","name":"Charnoz-sur-Ain","departmentCode":"01","departmentName":"Ain","latitude":45.8756,"longitude":5.2251,"population":951,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01088?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('edabd9b2-accd-557f-8f9a-4780a7a6476a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01089', 'hard', 3, '{"inseeCode":"01089","name":"Château-Gaillard","departmentCode":"01","departmentName":"Ain","latitude":45.9723,"longitude":5.3091,"population":2443,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01089?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c6d8fdf9-3feb-53f1-b61e-f88ac1554062', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01090', 'hard', 3, '{"inseeCode":"01090","name":"Châtenay","departmentCode":"01","departmentName":"Ain","latitude":46.0276,"longitude":5.2085,"population":373,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01090?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cd29e7f7-2b07-5457-8975-b0420d45db66', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01092', 'hard', 3, '{"inseeCode":"01092","name":"Châtillon-la-Palud","departmentCode":"01","departmentName":"Ain","latitude":45.9757,"longitude":5.246,"population":1698,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01092?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8d59a7d9-eb1b-5b93-afe2-2f12d48e2027', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01093', 'hard', 3, '{"inseeCode":"01093","name":"Châtillon-sur-Chalaronne","departmentCode":"01","departmentName":"Ain","latitude":46.1264,"longitude":4.9549,"population":5250,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01093?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ffd1d359-25ec-5075-9b27-615288e526c7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01094', 'hard', 3, '{"inseeCode":"01094","name":"Chavannes-sur-Reyssouze","departmentCode":"01","departmentName":"Ain","latitude":46.4403,"longitude":5.0069,"population":726,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01094?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fb59cfef-ba55-5a5b-ad8f-69891f783001', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01095', 'hard', 3, '{"inseeCode":"01095","name":"Nivigne et Suran","departmentCode":"01","departmentName":"Ain","latitude":46.2824,"longitude":5.4323,"population":820,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01095?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('66b44abd-b3d4-5b55-8540-59adcfcc06cf', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01096', 'hard', 3, '{"inseeCode":"01096","name":"Chaveyriat","departmentCode":"01","departmentName":"Ain","latitude":46.1991,"longitude":5.0534,"population":1078,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01096?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6ba6b960-a286-5915-ab75-14bdf14744ee', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01098', 'hard', 3, '{"inseeCode":"01098","name":"Chazey-Bons","departmentCode":"01","departmentName":"Ain","latitude":45.8007,"longitude":5.6678,"population":1142,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01098?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('362dd4d7-f3b6-5d2c-88bb-9ded50ead550', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01099', 'hard', 3, '{"inseeCode":"01099","name":"Chazey-sur-Ain","departmentCode":"01","departmentName":"Ain","latitude":45.8937,"longitude":5.2604,"population":1632,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01099?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('090f48eb-7f31-527b-9100-53947c24cc08', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01100', 'hard', 3, '{"inseeCode":"01100","name":"Cheignieu-la-Balme","departmentCode":"01","departmentName":"Ain","latitude":45.8233,"longitude":5.6022,"population":131,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01100?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3a44a6c8-6527-5e50-8d8b-38c5b7c9ad3e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01101', 'hard', 3, '{"inseeCode":"01101","name":"Chevillard","departmentCode":"01","departmentName":"Ain","latitude":46.1087,"longitude":5.5815,"population":149,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01101?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('aa2f4682-53ca-5be4-b898-57e8cc479b1f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01102', 'hard', 3, '{"inseeCode":"01102","name":"Chevroux","departmentCode":"01","departmentName":"Ain","latitude":46.3822,"longitude":4.9598,"population":990,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01102?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2184f422-c0fe-5d55-98da-ce28f065820d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01103', 'hard', 3, '{"inseeCode":"01103","name":"Chevry","departmentCode":"01","departmentName":"Ain","latitude":46.2841,"longitude":6.0474,"population":2372,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01103?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('229479ca-faeb-5dd1-b1fc-0dd063ac81c5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01104', 'hard', 3, '{"inseeCode":"01104","name":"Chézery-Forens","departmentCode":"01","departmentName":"Ain","latitude":46.2244,"longitude":5.8693,"population":433,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01104?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8093e15c-4462-50a0-976d-86cce02cac4e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01105', 'hard', 3, '{"inseeCode":"01105","name":"Civrieux","departmentCode":"01","departmentName":"Ain","latitude":45.9208,"longitude":4.8895,"population":2016,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01105?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bd8164a8-11a6-5c09-87ad-a3359bf14f40', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01106', 'hard', 3, '{"inseeCode":"01106","name":"Cize","departmentCode":"01","departmentName":"Ain","latitude":46.2015,"longitude":5.45,"population":168,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01106?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8e90dfd3-798e-5163-abe5-22383c734019', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01107', 'hard', 3, '{"inseeCode":"01107","name":"Cleyzieu","departmentCode":"01","departmentName":"Ain","latitude":45.9027,"longitude":5.4317,"population":143,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01107?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d9e9faf9-11e7-595c-901d-00fc8bad3c1b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01108', 'hard', 3, '{"inseeCode":"01108","name":"Coligny","departmentCode":"01","departmentName":"Ain","latitude":46.3889,"longitude":5.3352,"population":1360,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01108?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('89591208-359d-578b-b935-5643dc35a73b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01109', 'hard', 3, '{"inseeCode":"01109","name":"Collonges","departmentCode":"01","departmentName":"Ain","latitude":46.1397,"longitude":5.9007,"population":2398,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01109?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1f81ecb5-7293-58a7-bd05-4e3077066e01', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01110', 'hard', 3, '{"inseeCode":"01110","name":"Colomieu","departmentCode":"01","departmentName":"Ain","latitude":45.7338,"longitude":5.6269,"population":159,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01110?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('700250b1-3386-5b8e-a91a-c50ea3ee1c77', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01111', 'hard', 3, '{"inseeCode":"01111","name":"Conand","departmentCode":"01","departmentName":"Ain","latitude":45.8836,"longitude":5.4787,"population":134,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01111?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e2dda666-3835-5c00-ada7-2138b1f9c46d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01112', 'hard', 3, '{"inseeCode":"01112","name":"Condamine","departmentCode":"01","departmentName":"Ain","latitude":46.1056,"longitude":5.5596,"population":480,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01112?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1ab22ba0-00f7-5591-b767-ca49656cae96', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01113', 'hard', 3, '{"inseeCode":"01113","name":"Condeissiat","departmentCode":"01","departmentName":"Ain","latitude":46.1541,"longitude":5.0863,"population":839,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01113?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('37f93f5d-3183-5ecf-9b4f-f264e3d482a9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01114', 'hard', 3, '{"inseeCode":"01114","name":"Confort","departmentCode":"01","departmentName":"Ain","latitude":46.1536,"longitude":5.8358,"population":668,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01114?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('999a9fac-e8c0-5799-bcbd-7d49a27fabda', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01115', 'hard', 3, '{"inseeCode":"01115","name":"Confrançon","departmentCode":"01","departmentName":"Ain","latitude":46.2732,"longitude":5.06,"population":1356,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01115?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('81ee5591-32d4-5e6a-b69f-332ac9aee953', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01116', 'hard', 3, '{"inseeCode":"01116","name":"Contrevoz","departmentCode":"01","departmentName":"Ain","latitude":45.7971,"longitude":5.6164,"population":494,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01116?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8e3e4f11-bbf3-540e-9db8-2112113d43a7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01117', 'hard', 3, '{"inseeCode":"01117","name":"Conzieu","departmentCode":"01","departmentName":"Ain","latitude":45.7246,"longitude":5.602,"population":155,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01117?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f5cc4f3d-b37f-551e-af00-b8e038dec894', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01118', 'hard', 3, '{"inseeCode":"01118","name":"Corbonod","departmentCode":"01","departmentName":"Ain","latitude":45.9668,"longitude":5.7902,"population":1333,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01118?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3a923106-1154-5216-b163-5c9d6a8bf478', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01121', 'hard', 3, '{"inseeCode":"01121","name":"Corlier","departmentCode":"01","departmentName":"Ain","latitude":46.0369,"longitude":5.5003,"population":116,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01121?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('98ff5e3a-b3a8-58bb-bb49-c3ffe2688a3f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01123', 'hard', 3, '{"inseeCode":"01123","name":"Cormoranche-sur-Saône","departmentCode":"01","departmentName":"Ain","latitude":46.2459,"longitude":4.8305,"population":1179,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01123?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5d5d5b5f-3b48-55f8-b1ed-cda44297f7f0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01124', 'hard', 3, '{"inseeCode":"01124","name":"Cormoz","departmentCode":"01","departmentName":"Ain","latitude":46.4375,"longitude":5.2209,"population":703,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01124?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0449b726-692d-5883-824c-81d9c2a95fa1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01125', 'hard', 3, '{"inseeCode":"01125","name":"Corveissiat","departmentCode":"01","departmentName":"Ain","latitude":46.2514,"longitude":5.4771,"population":601,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01125?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e37e23ae-aeaf-5243-a936-56f18f7c14e5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01127', 'hard', 3, '{"inseeCode":"01127","name":"Courmangoux","departmentCode":"01","departmentName":"Ain","latitude":46.3243,"longitude":5.3585,"population":522,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01127?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('aac6c02c-7ba4-5d02-974e-5cde8e54f441', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01128', 'hard', 3, '{"inseeCode":"01128","name":"Courtes","departmentCode":"01","departmentName":"Ain","latitude":46.4564,"longitude":5.1128,"population":289,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01128?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b597d744-580f-5f32-b3be-5c57181d5700', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01129', 'hard', 3, '{"inseeCode":"01129","name":"Crans","departmentCode":"01","departmentName":"Ain","latitude":45.9667,"longitude":5.1917,"population":326,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01129?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2fb6d4f4-24de-50c7-9366-73333c772044', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01130', 'hard', 3, '{"inseeCode":"01130","name":"Bresse Vallons","departmentCode":"01","departmentName":"Ain","latitude":46.3271,"longitude":5.1822,"population":2388,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01130?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8fd98202-e872-52c9-823d-9ea8aabbabb3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01133', 'hard', 3, '{"inseeCode":"01133","name":"Cressin-Rochefort","departmentCode":"01","departmentName":"Ain","latitude":45.7833,"longitude":5.765,"population":380,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01133?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('aa73176a-2393-517b-91b5-50f9dec46c7e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01134', 'hard', 3, '{"inseeCode":"01134","name":"Crottet","departmentCode":"01","departmentName":"Ain","latitude":46.2848,"longitude":4.876,"population":1847,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01134?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9000034c-0192-5f82-bb58-9af3a9e7e767', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01135', 'hard', 3, '{"inseeCode":"01135","name":"Crozet","departmentCode":"01","departmentName":"Ain","latitude":46.2906,"longitude":5.9929,"population":2416,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01135?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('142d4ecd-82d8-5986-8a1d-fa9045114239', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01136', 'hard', 3, '{"inseeCode":"01136","name":"Cruzilles-lès-Mépillat","departmentCode":"01","departmentName":"Ain","latitude":46.2233,"longitude":4.876,"population":984,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01136?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a68b8023-a6c9-53c5-a6de-447fa6397433', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01138', 'hard', 3, '{"inseeCode":"01138","name":"Culoz-Béon","departmentCode":"01","departmentName":"Ain","latitude":45.8553,"longitude":5.7716,"population":3453,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01138?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('23f2c50b-5fd0-509f-a945-11f60823ad51', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01139', 'hard', 3, '{"inseeCode":"01139","name":"Curciat-Dongalon","departmentCode":"01","departmentName":"Ain","latitude":46.4883,"longitude":5.1666,"population":472,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01139?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bff56a1a-4881-5a89-8f75-cfe004bb4109', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01140', 'hard', 3, '{"inseeCode":"01140","name":"Curtafond","departmentCode":"01","departmentName":"Ain","latitude":46.2742,"longitude":5.1051,"population":825,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01140?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('ed204415-99c4-592d-8f31-805bdfb745df', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01141', 'hard', 3, '{"inseeCode":"01141","name":"Cuzieu","departmentCode":"01","departmentName":"Ain","latitude":45.8216,"longitude":5.6802,"population":424,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01141?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('25a8f173-a1fd-5f3c-b78b-0f3a98fc1663', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01142', 'hard', 3, '{"inseeCode":"01142","name":"Dagneux","departmentCode":"01","departmentName":"Ain","latitude":45.854,"longitude":5.0748,"population":4778,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01142?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('da3af5af-8790-5777-b4d8-713e504e6b3d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01143', 'hard', 3, '{"inseeCode":"01143","name":"Divonne-les-Bains","departmentCode":"01","departmentName":"Ain","latitude":46.3754,"longitude":6.1114,"population":10464,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01143?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('da70f541-ca12-545d-b3f7-808b53541249', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01145', 'hard', 3, '{"inseeCode":"01145","name":"Dompierre-sur-Veyle","departmentCode":"01","departmentName":"Ain","latitude":46.0672,"longitude":5.2167,"population":1245,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01145?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f92fedac-d3ac-51c9-8c2f-311db3a7d5c6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01146', 'hard', 3, '{"inseeCode":"01146","name":"Dompierre-sur-Chalaronne","departmentCode":"01","departmentName":"Ain","latitude":46.142,"longitude":4.9004,"population":456,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01146?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fcb45455-b1d2-5011-8f81-a7a33fbf6f83', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01147', 'hard', 3, '{"inseeCode":"01147","name":"Domsure","departmentCode":"01","departmentName":"Ain","latitude":46.4211,"longitude":5.2945,"population":554,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01147?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('da5f1b89-584f-5c51-ade4-2e83ebd4bfe4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01148', 'hard', 3, '{"inseeCode":"01148","name":"Dortan","departmentCode":"01","departmentName":"Ain","latitude":46.3184,"longitude":5.6443,"population":2074,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01148?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('7d3fbf79-b23b-557d-af5b-56c7543b1500', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01149', 'hard', 3, '{"inseeCode":"01149","name":"Douvres","departmentCode":"01","departmentName":"Ain","latitude":45.9847,"longitude":5.3724,"population":1104,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01149?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f3b42cac-b72f-5364-af29-4dbb53f3ac50', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01150', 'hard', 3, '{"inseeCode":"01150","name":"Drom","departmentCode":"01","departmentName":"Ain","latitude":46.2202,"longitude":5.3674,"population":215,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01150?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('99dd2da3-a997-534b-bb60-17e8358d84c4', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01151', 'hard', 3, '{"inseeCode":"01151","name":"Druillat","departmentCode":"01","departmentName":"Ain","latitude":46.0691,"longitude":5.2947,"population":1129,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01151?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6cb8c809-69dd-5d01-8d37-d93ad222b020', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01152', 'hard', 3, '{"inseeCode":"01152","name":"Échallon","departmentCode":"01","departmentName":"Ain","latitude":46.2293,"longitude":5.7346,"population":784,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01152?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bffccf07-6f61-5c65-80ef-5dfbbf7e6267', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01153', 'hard', 3, '{"inseeCode":"01153","name":"Échenevex","departmentCode":"01","departmentName":"Ain","latitude":46.3197,"longitude":6.018,"population":2328,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01153?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('36886c09-603b-5e32-ae72-ff69e744ac8b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01155', 'hard', 3, '{"inseeCode":"01155","name":"Évosges","departmentCode":"01","departmentName":"Ain","latitude":45.963,"longitude":5.5008,"population":142,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01155?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('54a98ca9-5fcf-5cf4-9894-18d0f40f1d26', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01156', 'hard', 3, '{"inseeCode":"01156","name":"Faramans","departmentCode":"01","departmentName":"Ain","latitude":45.9086,"longitude":5.126,"population":934,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01156?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('873bc19e-24c5-5f5b-bdf9-e25951fd4dec', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01157', 'hard', 3, '{"inseeCode":"01157","name":"Fareins","departmentCode":"01","departmentName":"Ain","latitude":46.0235,"longitude":4.7682,"population":2533,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01157?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('89222270-3812-56aa-9cea-203746880d2b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01158', 'hard', 3, '{"inseeCode":"01158","name":"Farges","departmentCode":"01","departmentName":"Ain","latitude":46.1657,"longitude":5.9054,"population":1082,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01158?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e436467c-1d18-5224-a2f7-9a0bd908f8e1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01159', 'hard', 3, '{"inseeCode":"01159","name":"Feillens","departmentCode":"01","departmentName":"Ain","latitude":46.3393,"longitude":4.8866,"population":3411,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01159?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('751532ad-8c9f-57d1-ab1c-1d49324c3c9b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01160', 'hard', 3, '{"inseeCode":"01160","name":"Ferney-Voltaire","departmentCode":"01","departmentName":"Ain","latitude":46.252,"longitude":6.1061,"population":12094,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01160?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6672afcf-a0c2-5361-91dd-a7c38f4c8a01', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01162', 'hard', 3, '{"inseeCode":"01162","name":"Flaxieu","departmentCode":"01","departmentName":"Ain","latitude":45.8125,"longitude":5.7466,"population":71,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01162?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a13c7b14-1b69-50f0-8573-9ca81f376024', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01163', 'hard', 3, '{"inseeCode":"01163","name":"Foissiat","departmentCode":"01","departmentName":"Ain","latitude":46.3792,"longitude":5.1851,"population":2034,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01163?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('da7cfcc5-8fc6-5455-acb1-736e486d3402', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01165', 'hard', 3, '{"inseeCode":"01165","name":"Francheleins","departmentCode":"01","departmentName":"Ain","latitude":46.0707,"longitude":4.8111,"population":1597,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01165?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('88acd3d3-918f-587b-90e3-c8fcef9872b6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01166', 'hard', 3, '{"inseeCode":"01166","name":"Frans","departmentCode":"01","departmentName":"Ain","latitude":45.9905,"longitude":4.7819,"population":2582,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01166?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e96fc01b-26a5-502b-99d7-114e7aa6e7e9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01167', 'hard', 3, '{"inseeCode":"01167","name":"Garnerans","departmentCode":"01","departmentName":"Ain","latitude":46.2124,"longitude":4.8289,"population":711,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01167?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cc22f0eb-f93b-55cf-b85f-d4a376820eea', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01169', 'hard', 3, '{"inseeCode":"01169","name":"Genouilleux","departmentCode":"01","departmentName":"Ain","latitude":46.1211,"longitude":4.7926,"population":701,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01169?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('edbebb03-7035-5ec5-8fa0-ccc19b4f5366', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01170', 'hard', 3, '{"inseeCode":"01170","name":"Béard-Géovreissiat","departmentCode":"01","departmentName":"Ain","latitude":46.1884,"longitude":5.5497,"population":1048,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01170?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d36670d4-2982-58fd-9b3a-9eef4919eba7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01171', 'hard', 3, '{"inseeCode":"01171","name":"Géovreisset","departmentCode":"01","departmentName":"Ain","latitude":46.2518,"longitude":5.6163,"population":852,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01171?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fbd817ee-d297-5498-bc87-e4a700703db1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01173', 'hard', 3, '{"inseeCode":"01173","name":"Gex","departmentCode":"01","departmentName":"Ain","latitude":46.3515,"longitude":6.0488,"population":13627,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01173?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cc850577-0409-50ca-8779-b07dc574cc62', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01174', 'hard', 3, '{"inseeCode":"01174","name":"Giron","departmentCode":"01","departmentName":"Ain","latitude":46.2209,"longitude":5.7891,"population":174,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01174?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6e7ef323-44f8-5138-b90e-da26af1a4ed1', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01175', 'hard', 3, '{"inseeCode":"01175","name":"Gorrevod","departmentCode":"01","departmentName":"Ain","latitude":46.4157,"longitude":4.9507,"population":815,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01175?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d974a0cd-ae41-5a69-963f-95714666d285', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01177', 'hard', 3, '{"inseeCode":"01177","name":"Grand-Corent","departmentCode":"01","departmentName":"Ain","latitude":46.2089,"longitude":5.4388,"population":183,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01177?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5006db7c-a5ca-57e4-9538-b2b9face8e34', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01179', 'hard', 3, '{"inseeCode":"01179","name":"Grièges","departmentCode":"01","departmentName":"Ain","latitude":46.2669,"longitude":4.8475,"population":1910,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01179?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b4c16192-9ed8-5a86-b05b-8b6194a3a735', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01180', 'hard', 3, '{"inseeCode":"01180","name":"Grilly","departmentCode":"01","departmentName":"Ain","latitude":46.3318,"longitude":6.1139,"population":889,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01180?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c2ab88d3-4948-5a24-ab56-c0a883e70069', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01181', 'hard', 3, '{"inseeCode":"01181","name":"Groissiat","departmentCode":"01","departmentName":"Ain","latitude":46.227,"longitude":5.6179,"population":1205,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01181?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('4157e934-f8e3-51cc-9ec2-b81fcc761812', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01183', 'hard', 3, '{"inseeCode":"01183","name":"Guéreins","departmentCode":"01","departmentName":"Ain","latitude":46.106,"longitude":4.7839,"population":1512,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01183?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('4508f1ef-b522-5c13-b8b1-7ad70689b0ec', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01184', 'hard', 3, '{"inseeCode":"01184","name":"Hautecourt-Romanèche","departmentCode":"01","departmentName":"Ain","latitude":46.1592,"longitude":5.4311,"population":748,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01184?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('242def74-3335-5f81-b3fd-3a1edd3f5b49', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01185', 'hard', 3, '{"inseeCode":"01185","name":"Plateau d''Hauteville","departmentCode":"01","departmentName":"Ain","latitude":45.9305,"longitude":5.5775,"population":4857,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01185?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f20393a3-423a-5598-b194-f094b43ae138', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01187', 'hard', 3, '{"inseeCode":"01187","name":"Haut Valromey","departmentCode":"01","departmentName":"Ain","latitude":46.0436,"longitude":5.6846,"population":801,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01187?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3f66bf63-4c16-579d-a2ca-76926671613c', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01188', 'hard', 3, '{"inseeCode":"01188","name":"Illiat","departmentCode":"01","departmentName":"Ain","latitude":46.1838,"longitude":4.8884,"population":702,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01188?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cd54aa30-4ce0-5774-9086-587864474068', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01189', 'hard', 3, '{"inseeCode":"01189","name":"Injoux-Génissiat","departmentCode":"01","departmentName":"Ain","latitude":46.0505,"longitude":5.7678,"population":1115,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01189?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('89580250-2487-52f6-9782-68470b8e3f63', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01190', 'hard', 3, '{"inseeCode":"01190","name":"Innimond","departmentCode":"01","departmentName":"Ain","latitude":45.7875,"longitude":5.5723,"population":95,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01190?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('f7da16d6-5800-5642-ab5f-9f2b5b7d6bb5', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01191', 'hard', 3, '{"inseeCode":"01191","name":"Izenave","departmentCode":"01","departmentName":"Ain","latitude":46.038,"longitude":5.5234,"population":162,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01191?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cc0bd942-5edd-59b4-840a-2a506db1e17e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01192', 'hard', 3, '{"inseeCode":"01192","name":"Izernore","departmentCode":"01","departmentName":"Ain","latitude":46.216,"longitude":5.5609,"population":2299,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01192?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2796dc70-bd6e-5282-8864-3cef594da35a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01193', 'hard', 3, '{"inseeCode":"01193","name":"Izieu","departmentCode":"01","departmentName":"Ain","latitude":45.6555,"longitude":5.6387,"population":225,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01193?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fc722bee-5dda-531f-82a7-022a6a623cde', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01194', 'hard', 3, '{"inseeCode":"01194","name":"Jassans-Riottier","departmentCode":"01","departmentName":"Ain","latitude":45.9771,"longitude":4.7626,"population":6247,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01194?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('27ffe99f-bd62-51b5-9416-525bc7958294', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01195', 'hard', 3, '{"inseeCode":"01195","name":"Jasseron","departmentCode":"01","departmentName":"Ain","latitude":46.2176,"longitude":5.317,"population":1917,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01195?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2ef7058a-8d96-58c2-8621-e29d2ed63a7e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01196', 'hard', 3, '{"inseeCode":"01196","name":"Jayat","departmentCode":"01","departmentName":"Ain","latitude":46.3698,"longitude":5.1117,"population":1261,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01196?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6390b0b2-6321-5180-86b9-f2998e1e9709', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01197', 'hard', 3, '{"inseeCode":"01197","name":"Journans","departmentCode":"01","departmentName":"Ain","latitude":46.1455,"longitude":5.3333,"population":387,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01197?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8ac7287a-2046-593f-97cf-65ce683cbf06', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01198', 'hard', 3, '{"inseeCode":"01198","name":"Joyeux","departmentCode":"01","departmentName":"Ain","latitude":45.946,"longitude":5.0998,"population":262,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01198?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('fa463233-c70d-5bfe-8b7a-1cfff0cf7669', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01199', 'hard', 3, '{"inseeCode":"01199","name":"Jujurieux","departmentCode":"01","departmentName":"Ain","latitude":46.0503,"longitude":5.4122,"population":2260,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01199?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a7b8e364-fcb6-5132-a20d-3f80b83f9385', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01200', 'hard', 3, '{"inseeCode":"01200","name":"Labalme","departmentCode":"01","departmentName":"Ain","latitude":46.0915,"longitude":5.4945,"population":204,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01200?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('40876798-dd92-56a1-9488-574e52146cdd', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01202', 'hard', 3, '{"inseeCode":"01202","name":"Lagnieu","departmentCode":"01","departmentName":"Ain","latitude":45.8863,"longitude":5.3396,"population":7411,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01202?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('18cdb0cf-5d27-5c75-a94d-b59e140bf53a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01203', 'hard', 3, '{"inseeCode":"01203","name":"Laiz","departmentCode":"01","departmentName":"Ain","latitude":46.2462,"longitude":4.9006,"population":1293,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01203?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('85bd342a-6695-533c-a764-8f25b20fa420', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01204', 'hard', 3, '{"inseeCode":"01204","name":"Le Poizat-Lalleyriat","departmentCode":"01","departmentName":"Ain","latitude":46.1392,"longitude":5.6955,"population":732,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01204?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('24cf867a-d0dc-50ff-9c30-b7f77ad25688', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01206', 'hard', 3, '{"inseeCode":"01206","name":"Lantenay","departmentCode":"01","departmentName":"Ain","latitude":46.0531,"longitude":5.5379,"population":260,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01206?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('329a7b7d-2366-55cf-9aee-bdff705b2413', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01207', 'hard', 3, '{"inseeCode":"01207","name":"Lapeyrouse","departmentCode":"01","departmentName":"Ain","latitude":45.9849,"longitude":4.9821,"population":348,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01207?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('41d1a820-6d62-5e48-9788-8e3c70f4e69a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01208', 'hard', 3, '{"inseeCode":"01208","name":"Lavours","departmentCode":"01","departmentName":"Ain","latitude":45.8108,"longitude":5.7707,"population":138,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01208?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('d49bfe81-1af1-53f9-94f4-5715c087f403', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01209', 'hard', 3, '{"inseeCode":"01209","name":"Léaz","departmentCode":"01","departmentName":"Ain","latitude":46.1114,"longitude":5.8768,"population":912,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01209?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b9ed6482-f1e8-554c-a114-fbfd55d5859d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01210', 'hard', 3, '{"inseeCode":"01210","name":"Lélex","departmentCode":"01","departmentName":"Ain","latitude":46.2856,"longitude":5.9274,"population":241,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01210?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1ab073f6-e45b-5a46-888e-65203d72b356', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01211', 'hard', 3, '{"inseeCode":"01211","name":"Lent","departmentCode":"01","departmentName":"Ain","latitude":46.1165,"longitude":5.1974,"population":1512,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01211?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6e6bc1d3-9d4e-5e70-810c-55aa4799151a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01212', 'hard', 3, '{"inseeCode":"01212","name":"Lescheroux","departmentCode":"01","departmentName":"Ain","latitude":46.4089,"longitude":5.1573,"population":726,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01212?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('3bdcb1ff-ba80-50a7-89d5-484c6b476e8f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01213', 'hard', 3, '{"inseeCode":"01213","name":"Leyment","departmentCode":"01","departmentName":"Ain","latitude":45.9287,"longitude":5.2927,"population":1441,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01213?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2ebb2a41-56d2-59cb-a85d-2cd0c3948ee6', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01214', 'hard', 3, '{"inseeCode":"01214","name":"Leyssard","departmentCode":"01","departmentName":"Ain","latitude":46.1605,"longitude":5.4767,"population":164,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01214?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1b99b85f-983b-5452-8c38-071747994423', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01215', 'hard', 3, '{"inseeCode":"01215","name":"Surjoux-Lhopital","departmentCode":"01","departmentName":"Ain","latitude":46.0302,"longitude":5.7666,"population":138,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01215?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('e20683f9-86cc-592a-a069-8404ab94efd7', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01216', 'hard', 3, '{"inseeCode":"01216","name":"Lhuis","departmentCode":"01","departmentName":"Ain","latitude":45.7469,"longitude":5.5398,"population":886,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01216?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a830a64b-b3f8-5122-8f41-fa4fbac925d8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01219', 'hard', 3, '{"inseeCode":"01219","name":"Lompnas","departmentCode":"01","departmentName":"Ain","latitude":45.8118,"longitude":5.5263,"population":171,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01219?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2123bd26-8edd-5922-94e2-b2853e412064', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01224', 'hard', 3, '{"inseeCode":"01224","name":"Loyettes","departmentCode":"01","departmentName":"Ain","latitude":45.7953,"longitude":5.2163,"population":3554,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01224?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6dd4fe58-7575-5f04-bcf1-f4190da50cc9', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01225', 'hard', 3, '{"inseeCode":"01225","name":"Lurcy","departmentCode":"01","departmentName":"Ain","latitude":46.0628,"longitude":4.7802,"population":406,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01225?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8d1d1f61-e1e4-593e-badf-e54668510ac3', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01227', 'hard', 3, '{"inseeCode":"01227","name":"Magnieu","departmentCode":"01","departmentName":"Ain","latitude":45.7763,"longitude":5.7197,"population":651,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01227?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a31c63d7-8b64-50dc-81cf-e939a9938286', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01228', 'hard', 3, '{"inseeCode":"01228","name":"Maillat","departmentCode":"01","departmentName":"Ain","latitude":46.1204,"longitude":5.535,"population":669,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01228?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('2be0746c-8549-5879-ba78-08b9f4d16e2b', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01229', 'hard', 3, '{"inseeCode":"01229","name":"Malafretaz","departmentCode":"01","departmentName":"Ain","latitude":46.3299,"longitude":5.1462,"population":1257,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01229?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('cbeafe54-1281-507a-8e93-4164d993fd70', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01230', 'hard', 3, '{"inseeCode":"01230","name":"Mantenay-Montlin","departmentCode":"01","departmentName":"Ain","latitude":46.4318,"longitude":5.1064,"population":331,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01230?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9e9e5050-d8ec-56b4-8df6-47c8fed240ad', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01231', 'hard', 3, '{"inseeCode":"01231","name":"Manziat","departmentCode":"01","departmentName":"Ain","latitude":46.3651,"longitude":4.9026,"population":2018,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01231?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('93ef93e9-385b-5c62-9d16-072fbf587e5f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01232', 'hard', 3, '{"inseeCode":"01232","name":"Marboz","departmentCode":"01","departmentName":"Ain","latitude":46.3452,"longitude":5.2461,"population":2264,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01232?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('386cea3f-13e8-53ad-9d25-5898f2fe37cf', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01233', 'hard', 3, '{"inseeCode":"01233","name":"Marchamp","departmentCode":"01","departmentName":"Ain","latitude":45.7762,"longitude":5.5509,"population":137,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01233?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('924b3ccf-bd8f-5191-92fb-8f468ed4b20a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01234', 'hard', 3, '{"inseeCode":"01234","name":"Marignieu","departmentCode":"01","departmentName":"Ain","latitude":45.8023,"longitude":5.718,"population":162,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01234?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0fd7573f-5ee9-5b2f-8e0b-b941ae010907', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01235', 'hard', 3, '{"inseeCode":"01235","name":"Marlieux","departmentCode":"01","departmentName":"Ain","latitude":46.0542,"longitude":5.0756,"population":1185,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01235?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c6a280ae-508c-589c-8bb0-895c634d07ef', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01236', 'hard', 3, '{"inseeCode":"01236","name":"Marsonnas","departmentCode":"01","departmentName":"Ain","latitude":46.3401,"longitude":5.0608,"population":1039,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01236?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('08135a63-a442-5d4a-9ce9-733b8e5d7b82', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01237', 'hard', 3, '{"inseeCode":"01237","name":"Martignat","departmentCode":"01","departmentName":"Ain","latitude":46.203,"longitude":5.6099,"population":1664,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01237?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('8734e4ab-b16e-5c0b-a9d4-d87126fc4854', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01238', 'hard', 3, '{"inseeCode":"01238","name":"Massieux","departmentCode":"01","departmentName":"Ain","latitude":45.9101,"longitude":4.8279,"population":2843,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01238?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0078e08c-ef95-5ac1-931d-66487b72974a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01239', 'hard', 3, '{"inseeCode":"01239","name":"Massignieu-de-Rives","departmentCode":"01","departmentName":"Ain","latitude":45.7564,"longitude":5.7566,"population":650,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01239?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('6425d929-d89d-52cf-afe8-ad39d15adafe', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01240', 'hard', 3, '{"inseeCode":"01240","name":"Matafelon-Granges","departmentCode":"01","departmentName":"Ain","latitude":46.2505,"longitude":5.5272,"population":623,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01240?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('eeef40a4-0219-5e7a-af04-31b684d1aa5e', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01241', 'hard', 3, '{"inseeCode":"01241","name":"Meillonnas","departmentCode":"01","departmentName":"Ain","latitude":46.2451,"longitude":5.3347,"population":1426,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01241?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5b76a03e-0f1c-5fb8-a785-45cbe7729705', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01242', 'hard', 3, '{"inseeCode":"01242","name":"Mérignat","departmentCode":"01","departmentName":"Ain","latitude":46.065,"longitude":5.4425,"population":129,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01242?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('af9e8654-89c0-5e90-932c-03db21627335', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01243', 'hard', 3, '{"inseeCode":"01243","name":"Messimy-sur-Saône","departmentCode":"01","departmentName":"Ain","latitude":46.048,"longitude":4.7609,"population":1338,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01243?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('9860eab2-4386-59d3-821c-eecf2c91c5d8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01244', 'hard', 3, '{"inseeCode":"01244","name":"Meximieux","departmentCode":"01","departmentName":"Ain","latitude":45.9047,"longitude":5.2116,"population":8247,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01244?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c681154b-8de5-5b48-8cbd-afe1fcef162a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01245', 'hard', 3, '{"inseeCode":"01245","name":"Bohas-Meyriat-Rignat","departmentCode":"01","departmentName":"Ain","latitude":46.1422,"longitude":5.375,"population":938,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01245?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('5fc0c73d-8aa1-5c95-b273-2e7327044057', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01246', 'hard', 3, '{"inseeCode":"01246","name":"Mézériat","departmentCode":"01","departmentName":"Ain","latitude":46.2424,"longitude":5.0481,"population":2172,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01246?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('bf21d5ca-4663-56cf-b1c0-8b9fb1f79d3f', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01247', 'hard', 3, '{"inseeCode":"01247","name":"Mijoux","departmentCode":"01","departmentName":"Ain","latitude":46.3593,"longitude":6.0106,"population":299,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01247?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('56c8b032-5751-5b12-b4eb-6c581b4ac9c8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01248', 'hard', 3, '{"inseeCode":"01248","name":"Mionnay","departmentCode":"01","departmentName":"Ain","latitude":45.8959,"longitude":4.9274,"population":2294,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01248?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('618634ee-c635-54ec-855f-89022f3f361a', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01249', 'hard', 3, '{"inseeCode":"01249","name":"Miribel","departmentCode":"01","departmentName":"Ain","latitude":45.8444,"longitude":4.941,"population":10395,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01249?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('a69d1cd9-b160-56e7-8f65-e88af95c7299', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01250', 'hard', 3, '{"inseeCode":"01250","name":"Misérieux","departmentCode":"01","departmentName":"Ain","latitude":45.9745,"longitude":4.8138,"population":2008,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01250?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('49972092-017a-5acb-a852-129fc7b23576', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01252', 'hard', 3, '{"inseeCode":"01252","name":"Mogneneins","departmentCode":"01","departmentName":"Ain","latitude":46.1454,"longitude":4.8203,"population":841,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01252?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('b0075b6e-049f-5cc3-997e-86ba52039d2d', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01254', 'hard', 3, '{"inseeCode":"01254","name":"Montagnat","departmentCode":"01","departmentName":"Ain","latitude":46.172,"longitude":5.2776,"population":2186,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01254?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('0e72ed75-b946-59a0-810a-78e4eea07650', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01255', 'hard', 3, '{"inseeCode":"01255","name":"Montagnieu","departmentCode":"01","departmentName":"Ain","latitude":45.802,"longitude":5.4598,"population":668,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01255?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('1e8166d7-d9c4-5594-be96-97818452ff36', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01257', 'hard', 3, '{"inseeCode":"01257","name":"Montanges","departmentCode":"01","departmentName":"Ain","latitude":46.171,"longitude":5.7903,"population":369,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01257?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('c483c350-4d8f-5fc8-a5e5-28daf9d4ebd8', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01258', 'hard', 3, '{"inseeCode":"01258","name":"Montceaux","departmentCode":"01","departmentName":"Ain","latitude":46.0978,"longitude":4.8041,"population":1196,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01258?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('81dd5c4a-a153-59d3-9ccc-e06fccde2194', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01259', 'hard', 3, '{"inseeCode":"01259","name":"Montcet","departmentCode":"01","departmentName":"Ain","latitude":46.2199,"longitude":5.1123,"population":709,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01259?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('426c41e3-a29c-5b7f-865f-ca3337b27df0', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01260', 'hard', 3, '{"inseeCode":"01260","name":"Le Montellier","departmentCode":"01","departmentName":"Ain","latitude":45.9284,"longitude":5.0699,"population":336,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01260?fields=nom,code,codeDepartement,population,centre"}'::jsonb),
  ('45c0e2a2-1749-541c-b37b-9baff4627dcc', 'b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001', '01261', 'hard', 3, '{"inseeCode":"01261","name":"Monthieux","departmentCode":"01","departmentName":"Ain","latitude":45.9631,"longitude":4.948,"population":664,"populationYear":2023,"difficulty":"hard","sourceUrl":"https://geo.api.gouv.fr/communes/01261?fields=nom,code,codeDepartement,population,centre"}'::jsonb)
on conflict (pack_id, logical_key) do nothing;

update public.games
set availability = 'ready', rules_version = 'geographie-1'
where slug = 'geographie';

-- Server-only RPCs. The application sends actor IDs derived from a verified
-- Auth session; clients cannot execute these functions.

-- Realtime is an invalidation channel only. The payload intentionally contains
-- no projection data; clients must re-read through the authenticated API.
drop policy if exists user_broadcast_receive on realtime.messages;
create policy user_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'user:' || (select auth.uid())::text
  and private = true
  and extension = 'broadcast'
  and topic = 'user:' || (select auth.uid())::text
);

create or replace function private.broadcast_room_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.room_id, 'version', new.version),
    'room.updated',
    'user:' || new.viewer_id::text,
    true
  );
  return new;
end;
$$;

create or replace function private.broadcast_match_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.match_id, 'version', new.version),
    'match.updated',
    'user:' || new.viewer_id::text,
    true
  );
  return new;
end;
$$;

create or replace function private.broadcast_history_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.match_id, 'version', 1),
    'history.updated',
    'user:' || new.viewer_id::text,
    true
  );
  return new;
end;
$$;

drop trigger if exists room_views_broadcast_update on public.room_views;
create trigger room_views_broadcast_update
after insert or update on public.room_views
for each row execute function private.broadcast_room_view_update();

drop trigger if exists match_views_broadcast_update on public.match_views;
create trigger match_views_broadcast_update
after insert or update on public.match_views
for each row execute function private.broadcast_match_view_update();

drop trigger if exists history_entries_broadcast_update on public.history_entries;
create trigger history_entries_broadcast_update
after insert or update on public.history_entries
for each row execute function private.broadcast_history_update();

create or replace function private.refresh_room_views(p_room_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_payload jsonb;
  v_member record;
begin
  select * into v_room from private.rooms where id = p_room_id;
  if not found then return; end if;
  select jsonb_build_object(
    'kind', 'room',
    'roomId', v_room.id,
    'code', v_room.code,
    'gameSlug', v_room.game_slug,
    'config', v_room.config,
    'status', v_room.status,
    'version', v_room.version,
    'currentMatchId', v_room.current_match_id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'pseudo', p.pseudo,
        'seat', rm.seat,
        'ready', rm.ready
      ) order by rm.seat)
      from private.room_members rm
      join public.profiles p on p.id = rm.user_id
      where rm.room_id = p_room_id
    ), '[]'::jsonb)
  ) into v_payload;
  for v_member in select user_id from private.room_members where room_id = p_room_id loop
    insert into public.room_views (room_id, viewer_id, version, payload, updated_at)
    values (p_room_id, v_member.user_id, v_room.version, v_payload, clock_timestamp())
    on conflict (room_id, viewer_id) do update set
      version = excluded.version,
      payload = excluded.payload,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

create or replace function private.claim_due_jobs(p_limit integer default 4)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jobs jsonb;
begin
  with due as (
    select id
    from private.jobs
    where (
      (status = 'pending' and run_at <= clock_timestamp())
      or (status = 'running' and lease_until <= clock_timestamp())
    )
    and attempts < 5
    order by run_at, id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 4), 1), 4)
  ), claimed as (
    update private.jobs j
    set status = 'running',
        attempts = j.attempts + 1,
        lease_token = extensions.gen_random_uuid(),
        lease_until = clock_timestamp() + interval '30 seconds',
        last_error_code = null
    from due
    where j.id = due.id
    returning j.id, j.match_id, j.kind, j.phase_id, j.payload, j.lease_token, j.run_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', id,
    'matchId', match_id,
    'kind', kind,
    'phaseId', phase_id,
    'payload', payload,
    'leaseToken', lease_token,
    'runAt', run_at
  ) order by run_at, id), '[]'::jsonb)
  into v_jobs
  from claimed;
  return v_jobs;
end;
$$;

create or replace function private.dispatch_due_jobs()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_worker_origin text;
  v_worker_secret text;
  v_jobs jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_worker_origin
  from vault.decrypted_secrets
  where name = 'worker_origin'
  limit 1;
  select decrypted_secret into v_worker_secret
  from vault.decrypted_secrets
  where name = 'internal_job_secret'
  limit 1;
  if v_worker_origin is null or v_worker_secret is null then
    return jsonb_build_object('dispatched', false, 'reason', 'WORKER_CONFIGURATION_MISSING');
  end if;
  v_jobs := private.claim_due_jobs(4);
  if jsonb_array_length(v_jobs) = 0 then
    return jsonb_build_object('dispatched', false, 'reason', 'NO_DUE_JOBS');
  end if;
  select net.http_post(
    url := rtrim(v_worker_origin, '/') || '/api/internal/jobs/run',
    body := jsonb_build_object('jobs', v_jobs),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-internal-job-secret', v_worker_secret
    ),
    timeout_milliseconds := 25000
  ) into v_request_id;
  return jsonb_build_object(
    'dispatched', true,
    'count', jsonb_array_length(v_jobs),
    'requestId', v_request_id
  );
exception
  when undefined_table or undefined_function then
    return jsonb_build_object('dispatched', false, 'reason', 'DISPATCH_EXTENSION_UNAVAILABLE');
end;
$$;

create or replace function public.server_get_actor(p_actor uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'pseudo', p.pseudo,
    'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path
  )
  from public.profiles p
  join private.site_members sm on sm.user_id = p.id
  where p.id = p_actor and sm.status = 'active';
$$;

create or replace function public.server_get_geography_content(p_difficulty text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with pack as (
    select id, version, manifest
    from private.content_packs
    where kind = 'geography' and slug = 'france-metropole' and status = 'published'
    order by version desc
    limit 1
  )
  select jsonb_build_object(
    'packId', pack.id,
    'packVersion', pack.version,
    'manifest', pack.manifest,
    'cities', coalesce((
      select jsonb_agg(ci.payload order by ci.logical_key)
      from private.content_items ci
      where ci.pack_id = pack.id
        and (p_difficulty is null or ci.category = p_difficulty)
    ), '[]'::jsonb)
  )
  from pack;
$$;

create or replace function public.server_get_room(p_actor uuid, p_room_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select rv.payload || jsonb_build_object('viewerId', p_actor)
  from public.room_views rv
  join private.room_members rm on rm.room_id = rv.room_id and rm.user_id = rv.viewer_id
  join private.site_members sm on sm.user_id = rv.viewer_id and sm.status = 'active'
  where rv.room_id = p_room_id and rv.viewer_id = p_actor;
$$;

create or replace function public.server_get_match(p_actor uuid, p_match_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'matchId', m.id,
    'roomId', m.room_id,
    'gameSlug', m.game_slug,
    'status', m.status,
    'mode', m.mode,
    'config', m.config,
    'rulesVersion', m.rules_version,
    'engineVersion', m.engine_version,
    'stateSchemaVersion', m.state_schema_version,
    'version', m.version,
    'phaseId', m.phase_id,
    'deadlineAt', m.deadline_at,
    'deadlineKind', m.deadline_kind,
    'startedAt', m.started_at,
    'players', (
      select jsonb_agg(jsonb_build_object(
        'id', mp.user_id,
        'seat', mp.seat,
        'pseudo', mp.pseudo_snapshot,
        'avatar', mp.avatar_snapshot,
        'lastSeenAt', mp.last_seen_at
      ) order by mp.seat)
      from private.match_players mp where mp.match_id = m.id
    ),
    'state', m.state,
    'view', mv.payload,
    'serverNow', clock_timestamp()
  )
  from private.matches m
  join private.match_players me on me.match_id = m.id and me.user_id = p_actor
  join private.site_members sm on sm.user_id = p_actor and sm.status = 'active'
  join public.match_views mv on mv.match_id = m.id and mv.viewer_id = p_actor
  where m.id = p_match_id;
$$;

create or replace function public.server_get_pair_history(
  p_actor uuid,
  p_opponent uuid,
  p_game text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'stats', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.game_slug)
      from private.pair_game_stats s
      where s.player_low = least(p_actor, p_opponent)
        and s.player_high = greatest(p_actor, p_opponent)
        and (p_game is null or s.game_slug = p_game)
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', h.match_id,
        'opponentId', h.opponent_id,
        'gameSlug', h.game_slug,
        'startedAt', h.started_at,
        'endedAt', h.ended_at,
        'outcome', h.outcome,
        'score', h.score,
        'opponentScore', h.opponent_score,
        'sharedScore', h.shared_score,
        'payload', h.payload
      ) order by h.ended_at desc, h.match_id desc)
      from public.history_entries h
      where h.viewer_id = p_actor
        and h.opponent_id = p_opponent
        and (p_game is null or h.game_slug = p_game)
    ), '[]'::jsonb)
  )
  where exists (
    select 1 from private.site_members sm
    where sm.user_id = p_actor and sm.status = 'active'
  )
    and exists (
      select 1 from private.site_members sm
      where sm.user_id = p_opponent and sm.status = 'active'
    );
$$;

create or replace function public.server_room_heartbeat(p_actor uuid, p_room_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_match_version bigint;
begin
  select * into v_room
  from private.rooms
  where id = p_room_id and status <> 'closed';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  update private.room_members
  set last_seen_at = clock_timestamp()
  where room_id = p_room_id and user_id = p_actor;
  select m.version into v_match_version
  from private.matches m
  where m.id = v_room.current_match_id;
  return jsonb_build_object(
    'roomId', p_room_id,
    'roomVersion', v_room.version,
    'matchVersion', v_match_version,
    'serverNow', clock_timestamp()
  );
end;
$$;

create or replace function public.server_match_heartbeat(p_actor uuid, p_match_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match private.matches%rowtype;
  v_opponent_last_seen timestamptz;
  v_room_version bigint;
begin
  select * into v_match from private.matches where id = p_match_id and status = 'active';
  if not found then raise exception 'MATCH_NOT_ACTIVE'; end if;
  if not exists (select 1 from private.match_players where match_id = p_match_id and user_id = p_actor) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  update private.match_players
  set last_seen_at = clock_timestamp()
  where match_id = p_match_id and user_id = p_actor;
  select last_seen_at into v_opponent_last_seen
  from private.match_players
  where match_id = p_match_id and user_id <> p_actor;
  select version into v_room_version from private.rooms where id = v_match.room_id;
  return jsonb_build_object(
    'matchId', p_match_id,
    'roomVersion', v_room_version,
    'matchVersion', v_match.version,
    'opponentLastSeenAt', v_opponent_last_seen,
    'serverNow', clock_timestamp()
  );
end;
$$;

create or replace function public.server_get_job_context(
  p_job_id uuid,
  p_lease_token uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'jobId', j.id,
    'jobKind', j.kind,
    'jobPhaseId', j.phase_id,
    'jobPayload', j.payload,
    'jobAttempts', j.attempts,
    'matchId', m.id,
    'roomId', m.room_id,
    'gameSlug', m.game_slug,
    'status', m.status,
    'mode', m.mode,
    'config', m.config,
    'rulesVersion', m.rules_version,
    'engineVersion', m.engine_version,
    'stateSchemaVersion', m.state_schema_version,
    'version', m.version,
    'phaseId', m.phase_id,
    'deadlineAt', m.deadline_at,
    'deadlineKind', m.deadline_kind,
    'startedAt', m.started_at,
    'players', (
      select jsonb_agg(jsonb_build_object(
        'id', mp.user_id,
        'seat', mp.seat,
        'pseudo', mp.pseudo_snapshot,
        'avatar', mp.avatar_snapshot,
        'lastSeenAt', mp.last_seen_at
      ) order by mp.seat)
      from private.match_players mp where mp.match_id = m.id
    ),
    'state', m.state,
    'serverNow', clock_timestamp()
  )
  from private.jobs j
  join private.matches m on m.id = j.match_id
  where j.id = p_job_id
    and j.status = 'running'
    and j.lease_token = p_lease_token
    and j.lease_until > clock_timestamp();
$$;

create or replace function public.server_create_room(
  p_actor uuid,
  p_request_id uuid,
  p_game_slug text,
  p_config jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_game public.games%rowtype;
  v_room_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  select response into v_existing from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id and route = 'create_room';
  if v_existing is not null then return v_existing; end if;
  if not exists (select 1 from private.site_members where user_id = p_actor and status = 'active') then
    raise exception 'MEMBER_REQUIRED';
  end if;
  select * into v_game from public.games where slug = p_game_slug;
  if not found or v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;
  v_room_id := extensions.gen_random_uuid();
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for v_byte_index in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, v_byte_index) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from private.rooms where code = v_code);
  end loop;
  insert into private.rooms (id, code, host_id, game_slug, config, version, expires_at)
  values (v_room_id, v_code, p_actor, p_game_slug, coalesce(p_config, '{}'::jsonb), 1, clock_timestamp() + interval '24 hours');
  insert into private.room_members (room_id, user_id, seat, ready)
  values (v_room_id, p_actor, 0, false);
  perform private.refresh_room_views(v_room_id);
  v_existing := jsonb_build_object('roomId', v_room_id, 'code', v_code, 'version', 1);
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'create_room', encode(extensions.digest(convert_to(p_game_slug || coalesce(p_config, '{}'::jsonb)::text, 'UTF8'), 'sha256'), 'hex'), v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_join_room(
  p_actor uuid,
  p_request_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_seat smallint;
  v_version bigint;
begin
  select response into v_existing from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id and route = 'join_room';
  if v_existing is not null then return v_existing; end if;
  if not exists (select 1 from private.site_members where user_id = p_actor and status = 'active') then raise exception 'MEMBER_REQUIRED'; end if;
  select * into v_room from private.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' or v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_CLOSED'; end if;
  if exists (select 1 from private.room_members where room_id = v_room.id and user_id = p_actor) then
    v_existing := jsonb_build_object('roomId', v_room.id, 'code', v_room.code, 'version', v_room.version);
  else
    if exists (select 1 from private.room_members where room_id = v_room.id and seat = 1) then raise exception 'ROOM_FULL'; end if;
    v_seat := 1;
    insert into private.room_members (room_id, user_id, seat, ready) values (v_room.id, p_actor, v_seat, false);
    update private.rooms set version = version + 1, expires_at = clock_timestamp() + interval '24 hours' where id = v_room.id returning version into v_version;
    perform private.refresh_room_views(v_room.id);
    v_existing := jsonb_build_object('roomId', v_room.id, 'code', v_room.code, 'version', v_version);
  end if;
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'join_room', encode(extensions.digest(convert_to(upper(trim(p_code)), 'UTF8'), 'sha256'), 'hex'), v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_set_room_ready(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_ready boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_version bigint;
begin
  select response into v_existing from private.room_command_receipts where room_id = p_room_id and command_id = p_command_id;
  if v_existing is not null then return v_existing; end if;
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update private.room_members set ready = p_ready, last_seen_at = clock_timestamp() where room_id = p_room_id and user_id = p_actor;
  update private.rooms set version = version + 1 where id = p_room_id returning version into v_version;
  perform private.refresh_room_views(p_room_id);
  v_existing := jsonb_build_object('roomId', p_room_id, 'version', v_version, 'ready', p_ready);
  insert into private.room_command_receipts (room_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
  values (p_room_id, p_command_id, p_actor, 'SET_READY', encode(extensions.digest(convert_to(p_ready::text, 'UTF8'), 'sha256'), 'hex'), v_version, v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_finish_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
begin
  if p_status not in ('done', 'cancelled') then raise exception 'INVALID_JOB_STATUS'; end if;
  select * into v_job from private.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('jobId', v_job.id, 'status', v_job.status);
  end if;
  if v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token or v_job.lease_until <= clock_timestamp() then
    raise exception 'JOB_LEASE_INVALID';
  end if;
  update private.jobs
  set status = p_status,
      last_error_code = p_error_code,
      completed_at = clock_timestamp(),
      lease_token = null,
      lease_until = null
  where id = p_job_id;
  if p_status = 'done' and v_job.kind = 'check_absence' and v_job.match_id is not null
     and exists (select 1 from private.matches m where m.id = v_job.match_id and m.status = 'active') then
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (
      v_job.match_id,
      'check_absence',
      null,
      v_job.id::text || ':next',
      jsonb_build_object('matchId', v_job.match_id, 'kind', 'check_absence'),
      clock_timestamp() + interval '30 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('jobId', p_job_id, 'status', p_status);
end;
$$;

create or replace function public.server_fail_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_next_status text;
  v_next_run_at timestamptz;
begin
  select * into v_job from private.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('jobId', v_job.id, 'status', v_job.status, 'terminal', true);
  end if;
  if v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token or v_job.lease_until <= clock_timestamp() then
    raise exception 'JOB_LEASE_INVALID';
  end if;
  if v_job.attempts >= 5 then
    v_next_status := 'failed';
    v_next_run_at := v_job.run_at;
  else
    v_next_status := 'pending';
    v_next_run_at := clock_timestamp() + case v_job.attempts
      when 1 then interval '1 second'
      when 2 then interval '2 seconds'
      when 3 then interval '4 seconds'
      else interval '8 seconds'
    end;
  end if;
  update private.jobs
  set status = v_next_status,
      run_at = v_next_run_at,
      last_error_code = left(coalesce(p_error_code, 'WORKER_ERROR'), 120),
      completed_at = case when v_next_status = 'failed' then clock_timestamp() else null end,
      lease_token = null,
      lease_until = null
  where id = p_job_id;
  return jsonb_build_object('jobId', p_job_id, 'status', v_next_status, 'terminal', v_next_status = 'failed');
end;
$$;

create or replace function public.server_start_match(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_match_id uuid,
  p_mode text,
  p_config jsonb,
  p_state jsonb,
  p_phase_id uuid,
  p_deadline_at timestamptz,
  p_deadline_kind text,
  p_views jsonb,
  p_jobs jsonb,
  p_content_manifest jsonb,
  p_rules_version text,
  p_engine_version text,
  p_state_schema_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_game public.games%rowtype;
  v_match_id uuid := p_match_id;
  v_version bigint;
  v_item jsonb;
  v_job jsonb;
begin
  select response into v_existing from private.room_command_receipts where room_id = p_room_id and command_id = p_command_id;
  if v_existing is not null then return v_existing; end if;
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_id <> p_actor then raise exception 'HOST_REQUIRED'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  select * into v_game from public.games where slug = v_room.game_slug;
  if v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;
  if (select count(*) from private.room_members where room_id = p_room_id) <> 2 then raise exception 'TWO_PLAYERS_REQUIRED'; end if;
  if exists (select 1 from private.room_members where room_id = p_room_id and not ready) then raise exception 'PLAYERS_NOT_READY'; end if;
  if p_mode not in ('random', 'challenge') then raise exception 'INVALID_MODE'; end if;
  if v_match_id is null then raise exception 'INVALID_MATCH_ID'; end if;
  insert into private.matches (
    id, room_id, game_slug, mode, config, rules_version, engine_version,
    state_schema_version, content_manifest, state, version, phase_id,
    deadline_at, deadline_kind
  ) values (
    v_match_id, p_room_id, v_room.game_slug, p_mode, p_config, p_rules_version, p_engine_version,
    p_state_schema_version, p_content_manifest, p_state, 0, p_phase_id, p_deadline_at, p_deadline_kind
  );
  insert into private.match_players (match_id, user_id, seat, pseudo_snapshot, avatar_snapshot)
  select v_match_id, rm.user_id, rm.seat, p.pseudo, jsonb_build_object('preset', p.avatar_preset, 'path', p.avatar_path)
  from private.room_members rm join public.profiles p on p.id = rm.user_id where rm.room_id = p_room_id order by rm.seat;
  for v_item in select * from jsonb_array_elements(p_views) loop
    insert into public.match_views (match_id, viewer_id, version, payload)
    values (v_match_id, (v_item->>'viewerId')::uuid, 0, v_item->'payload');
  end loop;
  for v_job in select * from jsonb_array_elements(coalesce(p_jobs, '[]'::jsonb)) loop
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (v_match_id, v_job->>'kind', nullif(v_job->>'phaseId', '')::uuid, v_job->>'dedupeKey', coalesce(v_job->'payload', '{}'::jsonb), (v_job->>'runAt')::timestamptz, 'pending')
    on conflict (dedupe_key) do nothing;
  end loop;
  insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
  values (
    v_match_id,
    'check_absence',
    null,
    v_match_id::text || ':absence:0',
    jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
    clock_timestamp() + interval '30 seconds',
    'pending'
  )
  on conflict (dedupe_key) do nothing;
  update private.rooms set status = 'playing', current_match_id = v_match_id, version = version + 1 where id = p_room_id returning version into v_version;
  perform private.refresh_room_views(p_room_id);
  v_existing := jsonb_build_object('matchId', v_match_id, 'roomId', p_room_id, 'version', 0);
  insert into private.room_command_receipts (room_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
  values (p_room_id, p_command_id, p_actor, 'START_MATCH', encode(extensions.digest(convert_to(p_state::text, 'UTF8'), 'sha256'), 'hex'), v_version, v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_commit_match(p_envelope jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match private.matches%rowtype;
  v_current_job private.jobs%rowtype;
  v_match_id uuid := (p_envelope->>'matchId')::uuid;
  v_actor_id uuid := nullif(p_envelope->>'actorId', '')::uuid;
  v_command_id uuid := (p_envelope->>'commandId')::uuid;
  v_job_id uuid := nullif(p_envelope->>'jobId', '')::uuid;
  v_lease_token uuid := nullif(p_envelope->>'leaseToken', '')::uuid;
  v_source text := coalesce(p_envelope->>'source', 'player');
  v_expected_version bigint := (p_envelope->>'expectedVersion')::bigint;
  v_new_version bigint;
  v_existing jsonb;
  v_next jsonb := p_envelope->'next';
  v_state jsonb := v_next->'state';
  v_result jsonb := p_envelope->'result';
  v_event jsonb := p_envelope->'event';
  v_view_item jsonb;
  v_job jsonb;
  v_record jsonb;
  v_result_player jsonb;
  v_match_player record;
  v_user_id uuid;
  v_opponent uuid;
  v_outcome text;
  v_score numeric;
  v_metrics jsonb;
  v_winner uuid;
  v_ended_at timestamptz;
  v_actor_view jsonb;
begin
  if v_source = 'job' then
    select response into v_existing from private.job_receipts where job_id = v_job_id;
    if v_existing is not null then
      if v_existing->>'commandHash' <> p_envelope->>'commandHash' then raise exception 'COMMAND_ID_REUSED'; end if;
      return v_existing;
    end if;
  else
    select response into v_existing from private.command_receipts
    where match_id = v_match_id and command_id = v_command_id;
    if v_existing is not null then
      if v_existing->>'commandHash' <> p_envelope->>'commandHash' then raise exception 'COMMAND_ID_REUSED'; end if;
      return v_existing;
    end if;
  end if;
  select * into v_match from private.matches where id = v_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_match.status <> 'active' then raise exception 'MATCH_NOT_ACTIVE'; end if;
  if v_match.version <> v_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_match.phase_id <> (p_envelope->>'previousPhaseId')::uuid then raise exception 'PHASE_CONFLICT'; end if;
  if v_source = 'player' then
    if v_actor_id is null or not exists (select 1 from private.match_players where match_id = v_match_id and user_id = v_actor_id) then raise exception 'NOT_A_PARTICIPANT'; end if;
    if v_match.deadline_at is not null and v_match.deadline_at <= clock_timestamp() then raise exception 'DEADLINE_EXPIRED'; end if;
    update private.match_players set last_seen_at = clock_timestamp()
    where match_id = v_match_id and user_id = v_actor_id;
    if coalesce(v_event->>'type', '') = 'FORFEIT_CLAIMED' and not exists (
      select 1
      from private.match_players
      where match_id = v_match_id
        and user_id <> v_actor_id
        and last_seen_at <= clock_timestamp() - interval '90 seconds'
    ) then
      raise exception 'FORFEIT_NOT_AVAILABLE';
    end if;
  elsif v_source = 'job' then
    if v_job_id is null or v_lease_token is null then raise exception 'JOB_LEASE_INVALID'; end if;
    select * into v_current_job from private.jobs where id = v_job_id for update;
    if not found or v_current_job.match_id is distinct from v_match_id or v_current_job.status <> 'running' or v_current_job.lease_token is distinct from v_lease_token or v_current_job.lease_until <= clock_timestamp() then
      raise exception 'JOB_LEASE_INVALID';
    end if;
    if v_current_job.phase_id is not null and v_current_job.phase_id <> v_match.phase_id then raise exception 'STALE_JOB'; end if;
    if v_current_job.kind = 'check_absence' then
      if not (
        (select count(*) from private.match_players where match_id = v_match_id and last_seen_at <= clock_timestamp() - interval '120 seconds') = 2
        or (select count(*) from private.match_players where match_id = v_match_id and last_seen_at <= clock_timestamp() - interval '180 seconds') >= 1
      ) then
        raise exception 'JOB_NOT_DUE';
      end if;
    elsif v_match.deadline_at is null or v_match.deadline_at > clock_timestamp() then
      raise exception 'JOB_NOT_DUE';
    end if;
  else
    raise exception 'INVALID_COMMIT_SOURCE';
  end if;
  v_new_version := v_match.version + 1;
  if jsonb_array_length(p_envelope->'views') <> 2 then raise exception 'INVALID_VIEWS'; end if;
  for v_view_item in select * from jsonb_array_elements(p_envelope->'views') loop
    if not exists (select 1 from private.match_players where match_id = v_match_id and user_id = (v_view_item->>'viewerId')::uuid) then raise exception 'INVALID_VIEWER'; end if;
    if (v_view_item->>'viewerId')::uuid = v_actor_id then v_actor_view := v_view_item->'payload'; end if;
  end loop;
  if v_actor_view is null and v_source = 'player' then raise exception 'MISSING_ACTOR_VIEW'; end if;
  update private.matches set
    state = v_state,
    version = v_new_version,
    phase_id = (v_next->>'phaseId')::uuid,
    deadline_at = nullif(v_next->>'deadlineAt', '')::timestamptz,
    deadline_kind = nullif(v_next->>'deadlineKind', ''),
    status = case when v_result is null or jsonb_typeof(v_result) = 'null' then 'active' else case when v_result->>'outcome' = 'abandoned' then 'abandoned' else 'completed' end end,
    ended_at = case when v_result is null or jsonb_typeof(v_result) = 'null' then null else clock_timestamp() end,
    end_reason = case when v_result is null or jsonb_typeof(v_result) = 'null' then null else v_result->>'reason' end
  where id = v_match_id;
  update private.jobs set status = 'cancelled', completed_at = clock_timestamp(), lease_token = null, lease_until = null
  where match_id = v_match_id and status in ('pending', 'running') and (v_source <> 'job' or id <> v_job_id);
  for v_job in select * from jsonb_array_elements(coalesce(p_envelope->'jobsToUpsert', '[]'::jsonb)) loop
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (v_match_id, v_job->>'kind', nullif(v_job->>'phaseId', '')::uuid, v_job->>'dedupeKey', coalesce(v_job->'payload', '{}'::jsonb), (v_job->>'runAt')::timestamptz, 'pending')
    on conflict (dedupe_key) do nothing;
  end loop;
  if v_result is null or jsonb_typeof(v_result) = 'null' then
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (
      v_match_id,
      'check_absence',
      null,
      v_match_id::text || ':absence:' || v_new_version::text,
      jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
      clock_timestamp() + interval '30 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;
  for v_record in select * from jsonb_array_elements(coalesce(p_envelope->'roundRecords', '[]'::jsonb)) loop
    insert into private.round_results (match_id, round_no, summary, completed_at)
    values (v_match_id, (v_record->>'roundNo')::integer, v_record->'summary', (v_record->>'completedAt')::timestamptz)
    on conflict (match_id, round_no) do nothing;
  end loop;
  insert into private.match_events (match_id, version, event_type, actor_id, payload)
  values (v_match_id, v_new_version, coalesce(v_event->>'type', 'TRANSITION'), v_actor_id, coalesce(v_event->'payload', '{}'::jsonb));
  for v_view_item in select * from jsonb_array_elements(p_envelope->'views') loop
    insert into public.match_views (match_id, viewer_id, version, payload, updated_at)
    values (v_match_id, (v_view_item->>'viewerId')::uuid, v_new_version, v_view_item->'payload', clock_timestamp())
    on conflict (match_id, viewer_id) do update set version = excluded.version, payload = excluded.payload, updated_at = excluded.updated_at;
  end loop;
  if v_result is not null and jsonb_typeof(v_result) <> 'null' then
    v_winner := nullif(v_result->>'winnerId', '')::uuid;
    v_ended_at := clock_timestamp();
    insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason, completed_at)
    values (v_match_id, v_result->>'kind', v_result->>'outcome', v_winner, nullif(v_result->>'sharedScore', '')::numeric, coalesce(v_result->'summary', '{}'::jsonb), v_result->>'reason', v_ended_at)
    on conflict (match_id) do nothing;
    for v_result_player in select * from jsonb_array_elements(v_result->'players') loop
      v_user_id := (v_result_player->>'userId')::uuid;
      v_score := nullif(v_result_player->>'score', '')::numeric;
      v_metrics := coalesce(v_result_player->'metrics', '{}'::jsonb);
      v_outcome := case
        when v_result->>'outcome' = 'abandoned' then 'abandoned'
        when v_result->>'outcome' = 'draw' then 'draw'
        when v_winner = v_user_id then 'win'
        else 'loss'
      end;
      insert into private.player_results (match_id, user_id, outcome, score, metrics)
      values (v_match_id, v_user_id, v_outcome, v_score, v_metrics)
      on conflict (match_id, user_id) do nothing;
      insert into public.player_game_stats (user_id, game_slug, played, wins, losses, draws, cooperative, abandoned, metrics)
      values (
        v_user_id, v_match.game_slug,
        case when v_outcome in ('win', 'loss', 'draw', 'cooperative') then 1 else 0 end,
        case when v_outcome = 'win' then 1 else 0 end,
        case when v_outcome = 'loss' then 1 else 0 end,
        case when v_outcome = 'draw' then 1 else 0 end,
        case when v_outcome = 'cooperative' then 1 else 0 end,
        case when v_outcome = 'abandoned' then 1 else 0 end,
        v_metrics
      )
      on conflict (user_id, game_slug) do update set
        played = public.player_game_stats.played + excluded.played,
        wins = public.player_game_stats.wins + excluded.wins,
        losses = public.player_game_stats.losses + excluded.losses,
        draws = public.player_game_stats.draws + excluded.draws,
        cooperative = public.player_game_stats.cooperative + excluded.cooperative,
        abandoned = public.player_game_stats.abandoned + excluded.abandoned,
        metrics = public.player_game_stats.metrics || excluded.metrics,
        updated_at = clock_timestamp();
    end loop;
    for v_match_player in select * from private.match_players where match_id = v_match_id loop
      select user_id into v_opponent from private.match_players where match_id = v_match_id and user_id <> v_match_player.user_id;
      v_score := nullif((v_result->'players'->v_match_player.seat->>'score'), '')::numeric;
      insert into public.history_entries (viewer_id, match_id, opponent_id, game_slug, started_at, ended_at, outcome, score, opponent_score, shared_score, payload)
      values (
        v_match_player.user_id, v_match_id, v_opponent, v_match.game_slug, v_match.started_at, v_ended_at,
        case when v_result->>'outcome' = 'abandoned' then 'abandoned' when v_result->>'outcome' = 'draw' then 'draw' when v_winner = v_match_player.user_id then 'win' else 'loss' end,
        v_score,
        nullif((v_result->'players'->(1-v_match_player.seat)->>'score'), '')::numeric,
        nullif(v_result->>'sharedScore', '')::numeric,
        jsonb_build_object(
          'summary', coalesce(v_result->'summary', '{}'::jsonb),
          'reason', v_result->>'reason',
          'players', coalesce((
            select jsonb_agg(jsonb_build_object(
              'userId', mp.user_id,
              'pseudo', mp.pseudo_snapshot,
              'score', nullif((v_result->'players'->mp.seat->>'score'), '')::numeric,
              'metrics', coalesce(v_result->'players'->mp.seat->'metrics', '{}'::jsonb)
            ) order by mp.seat)
            from private.match_players mp
            where mp.match_id = v_match_id
          ), '[]'::jsonb)
        )
      ) on conflict (viewer_id, match_id) do nothing;
    end loop;
    if v_result->>'kind' = 'competitive' then
      insert into private.pair_game_stats (player_low, player_high, game_slug, played, low_wins, high_wins, draws, cooperative, abandoned, metrics)
      select least(mp0.user_id, mp1.user_id), greatest(mp0.user_id, mp1.user_id), v_match.game_slug,
        case when v_result->>'outcome' in ('win','draw') then 1 else 0 end,
        case when v_result->>'outcome' = 'win' and v_winner = least(mp0.user_id, mp1.user_id) then 1 else 0 end,
        case when v_result->>'outcome' = 'win' and v_winner = greatest(mp0.user_id, mp1.user_id) then 1 else 0 end,
        case when v_result->>'outcome' = 'draw' then 1 else 0 end,
        0,
        case when v_result->>'outcome' = 'abandoned' then 1 else 0 end,
        coalesce(v_result->'summary', '{}'::jsonb)
      from (select user_id from private.match_players where match_id = v_match_id and seat = 0) mp0,
           (select user_id from private.match_players where match_id = v_match_id and seat = 1) mp1
      on conflict (player_low, player_high, game_slug) do update set
        played = private.pair_game_stats.played + excluded.played,
        low_wins = private.pair_game_stats.low_wins + excluded.low_wins,
        high_wins = private.pair_game_stats.high_wins + excluded.high_wins,
        draws = private.pair_game_stats.draws + excluded.draws,
        abandoned = private.pair_game_stats.abandoned + excluded.abandoned,
        metrics = private.pair_game_stats.metrics || excluded.metrics,
        updated_at = clock_timestamp();
    end if;
    update private.room_members
    set ready = false
    where room_id = v_match.room_id;
    update private.rooms
    set status = 'waiting', current_match_id = null, version = version + 1
    where id = v_match.room_id;
    perform private.refresh_room_views(v_match.room_id);
  end if;
  v_existing := jsonb_build_object(
    'matchId', v_match_id,
    'version', v_new_version,
    'commandHash', p_envelope->>'commandHash',
    'view', v_actor_view
  );
  if v_source = 'job' then
    update private.jobs
    set status = 'done', completed_at = clock_timestamp(), lease_token = null, lease_until = null
    where id = v_job_id;
    v_existing := v_existing || jsonb_build_object('jobId', v_job_id);
    insert into private.job_receipts (job_id, payload_hash, committed_version, response)
    values (v_job_id, p_envelope->>'commandHash', v_new_version, v_existing);
  else
    insert into private.command_receipts (match_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
    values (v_match_id, v_command_id, v_actor_id, coalesce(v_event->>'type', 'TRANSITION'), p_envelope->>'commandHash', v_new_version, v_existing);
  end if;
  return v_existing;
end;
$$;

revoke all on function private.broadcast_room_view_update() from public, anon, authenticated;
revoke all on function private.broadcast_match_view_update() from public, anon, authenticated;
revoke all on function private.broadcast_history_update() from public, anon, authenticated;
revoke all on function private.refresh_room_views(uuid) from public, anon, authenticated;
revoke all on function private.claim_due_jobs(integer) from public, anon, authenticated;
revoke all on function private.dispatch_due_jobs() from public, anon, authenticated;
revoke all on function public.server_get_actor(uuid) from public, anon, authenticated;
revoke all on function public.server_get_geography_content(text) from public, anon, authenticated;
revoke all on function public.server_get_room(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_get_match(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_get_pair_history(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_room_heartbeat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_match_heartbeat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_get_job_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_create_room(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.server_join_room(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean) from public, anon, authenticated;
revoke all on function public.server_finish_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.server_fail_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer) from public, anon, authenticated;
revoke all on function public.server_commit_match(jsonb) from public, anon, authenticated;
grant execute on function private.claim_due_jobs(integer) to service_role;
grant execute on function private.dispatch_due_jobs() to service_role;
grant execute on function public.server_get_actor(uuid) to service_role;
grant execute on function public.server_get_geography_content(text) to service_role;
grant execute on function public.server_get_room(uuid, uuid) to service_role;
grant execute on function public.server_get_match(uuid, uuid) to service_role;
grant execute on function public.server_get_pair_history(uuid, uuid, text) to service_role;
grant execute on function public.server_room_heartbeat(uuid, uuid) to service_role;
grant execute on function public.server_match_heartbeat(uuid, uuid) to service_role;
grant execute on function public.server_get_job_context(uuid, uuid) to service_role;
grant execute on function public.server_create_room(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.server_join_room(uuid, uuid, text) to service_role;
grant execute on function public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean) to service_role;
grant execute on function public.server_finish_job(uuid, uuid, text, text) to service_role;
grant execute on function public.server_fail_job(uuid, uuid, text) to service_role;
grant execute on function public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer) to service_role;
grant execute on function public.server_commit_match(jsonb) to service_role;
grant execute on function private.refresh_room_views(uuid) to service_role;
grant all on all tables in schema private to service_role;
grant all on all sequences in schema private to service_role;
grant select on public.profiles, public.games to service_role;
grant select, insert, update, delete on public.room_views, public.match_views, public.history_entries, public.player_game_stats to service_role;

