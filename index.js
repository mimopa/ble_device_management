require('dotenv').config();
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const downlinkRequest = require('request');
const env = process.env;

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
      if (request.body === null) {
        errorJson = {
          error: { message: 'Error could not get request body' },
        };
        response.status(400).send(JSON.stringify(errorJson));
        return '';
      }
      console.log(request.body.payload_fields);
      var device_id = request.body.dev_id;
      // デバイスマスタ：devices/
      // ここに時間設定の情報を保持する
      // free:無償設定時間
      // silly:いたずら検出時間
      // continues:継続検出時間
      var deviceSnapshot = await db.collection('devices').doc(device_id).get();
      var devicesData = deviceSnapshot.data();
      console.log(devicesData);
      if (devicesData === null) {
        errorJson = {
          error: { message: 'Error device is not registered' },
        };
        response.status(400).send(JSON.stringify(errorJson));
        return '';
      }
      // 鍵データ
      var area_id = devicesData.area_id;
      var parking_id = devicesData.parking_id;
      var key_id = devicesData.key_id;
      var free = devicesData.free;
      var silly = devicesData.silly;
      var continues = devicesData.continues;
      var parkingRef = db
        .collection('area')
        .doc(area_id)
        .collection('parking')
        .doc(parking_id)
        .collection('keiys')
        .doc(key_id);
      console.log(parkingRef);
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
        await parkingRef.set(
          {
            status: request.body.payload_fields.status.toString(),
            battery: request.body.payload_fields.battery.toString(),
          },
          { merge: true }
        );
      }

      // ペイロード作成
      var options = {
        uri: env.LORA_URL,
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          dev_id: request.body.dev_id,
          port: 1,
          comfirmed: false,
          payload_fields: {
            ack: 0, // ack
            free: 10, // 無料時間
            silly: 30, // いたずら検知時間
            continues: 0, // 継続検出時間
          },
        }),
      };
      console.log(options);
      downlinkRequest.post(options, (error, res, body) => {
        console.log(error);
        console.log(res);
        console.log(body);
      });
      // TODO:利用ログの記録
      // ダウンリンク送信後、レスポンスを返す
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
