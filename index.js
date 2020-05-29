const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);

var db = admin.firestore();

exports.statusUpdate = functions.https.onRequest(async (request, response) => {
  var errorJson;
  var successJson = { success: { message: 'データを追加しました。' } };
  response.set('Access-Control-Allow-Origin', '*');
  switch (request.method) {
    case 'GET':
      response.status(200).send('Hello World!');
      break;

    case 'POST':
      // デバイスIDの取得
      console.log(request.body);
      if (request.body === null) {
        errorJson = {
          error: { message: 'Error could not get request body' },
        };
        response.status(400).send(JSON.stringify(errorJson));
        return '';
      }
      var device_id = request.body.dev_id;
      // デバイスマスタ：devices/
      // デバイスマスタはデバイスIDと、地域No、駐輪場No、駐輪機Noを紐付けるテーブルで、事前に手動で設定する。
      var deviceSnapshot = await db.collection('devices').doc(device_id).get();
      var devicesData = deviceSnapshot.data();
      console.log(devicesData);
      var area_id = devicesData.area_id;
      var parking_id = devicesData.parking_id;
      var key_id = devicesData.key_id;
      // console.log(request.body.payload_fields.status);
      // 駐輪機マスタの更新
      // 駐輪機マスタは、デバイスマスタから取得した地域No、駐輪場No、駐輪機Noを特定し、ステータス、解錠キー、バッテリーなどを登録する。
      var parkingRef = db
        .collection('area')
        .doc(area_id)
        .collection('parking')
        .doc(parking_id)
        .collection('keiys')
        .doc(key_id);
      console.log(parkingRef);
      // status:0（空車）、1（入庫無償）、2（入庫有償）、3（出庫）、4（継続）、5（SPL）、6（入庫準備）、7（故障）
      // status:1（入庫無償）、2（入庫有償）以外の場合は、open_keyは更新しない
      if (
        request.body.payload_fields.status === 1 ||
        request.body.payload_fields.status === 2
      ) {
        await parkingRef.set(
          {
            key_id: key_id,
            dev_id: request.body.dev_id,
            open_key: request.body.payload_fields.code
              .toString()
              .replace('0x', ''),
            status: request.body.payload_fields.status.toString(),
            battery: request.body.payload_fields.battery.toString(),
            date: admin.firestore.Timestamp.fromDate(new Date()),
          },
          { merge: true }
        );
      } else {
        // status:
        await parkingRef.set(
          {
            status: request.body.payload_fields.status.toString(),
            battery: request.body.payload_fields.battery.toString(),
            // date: admin.firestore.Timestamp.fromDate(new Date()),
          },
          { merge: true }
        );
      }
      response.status(200).send(JSON.stringify(successJson));
      break;
    default:
      errorJson = {
        error: { message: 'GETとPOSTにのみ対応しています。' },
      };
      response.status(400).send(JSON.stringify(errorJson));
      break;
  }
});
