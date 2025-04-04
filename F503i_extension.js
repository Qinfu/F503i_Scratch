/**********************************************
 F503i用機能拡張ブロック for Turbo Brow

 version 1.0
 last update 2025.04.05
 Auther Shima（plane-plan）

https://turbowarp.org

reference materials
	https://github.com/code4fukui/Webembot/

***********************************************/

const UUID_SERVICE = "f7fce510-7a0b-4b89-a675-a79137223e2c";
const UUID_KEYS = "f7fce531-7a0b-4b89-a675-a79137223e2c";
const LED_G = "f7fce515-7a0b-4b89-a675-a79137223e2c";
const LED_Y = "f7fce516-7a0b-4b89-a675-a79137223e2c";
const LED_R = "f7fce51a-7a0b-4b89-a675-a79137223e2c";
const CHAR_BUZZER = "f7fce521-7a0b-4b89-a675-a79137223e2c";
const CHAR_BRIGHT = "f7fce532-7a0b-4b89-a675-a79137223e2c";

console.log("f503iExtension","loaded");

(function(Scratch) {
	class BLEExtension {

		constructor() {
			this.runtime = Scratch.vm.runtime;
			this.blestates = 0;
			this.characteristic = null;
			this.receivedData = '';
			this.lastKey = null;
			this.ledChars ={_g:null,_y:null,_r:null};
			this.ledState = {_g:0,_y:0,_r:0};
			this.buzzer = null;
			this.brightness = null;
		}

		async connect() {
			try {
				const xDevice = await navigator.bluetooth.requestDevice({
					optionalServices: [UUID_SERVICE],
					filters: [
						{ namePrefix: "F503i_"},
					],
				});

				const xServer = await xDevice.gatt.connect();
				const xService = await xServer.getPrimaryService(UUID_SERVICE);
				this.characteristic = await xService.getCharacteristic(UUID_KEYS);
				
				// キー入力イベントリスナーを設定
				this.characteristic.addEventListener('characteristicvaluechanged', this.onPushKeyEvent.bind(this));
				await this.characteristic.startNotifications();

				//LED
				this.ledChars._g = await xService.getCharacteristic(LED_G);
				this.ledChars._y = await xService.getCharacteristic(LED_Y);
				this.ledChars._r = await xService.getCharacteristic(LED_R);

				//ブザー
				this.buzzer = await xService.getCharacteristic(CHAR_BUZZER);

				//明度センサ
				this.brightness = await xService.getCharacteristic(CHAR_BRIGHT);

				this.blestates = 1;
				xDevice.addEventListener('gattserverdisconnected', this.onDisconnectEvent.bind(this));

				console.log("F503i","Connected");
			} catch (error) {
				console.error('BLE接続エラー:', error);
			}
		}


		//F503iが切断された
		onDisconnectEvent(evt){
			console.log("F503i","Disconnected");
			if(this.blestates == 1){
				// HATブロックの発火
				setTimeout(() => {
					this.runtime.startHats('ble_DisconnecedAction', {});
					this.blestates = 2;
				}, 0);
			}
		}


		//キーイベント発生
		onPushKeyEvent(evt) {
			const xVal = evt.target.value;
			this.receivedData = this.fsCodeToLetter(xVal);
			//console.log('Key:', this.receivedData);

			if(this.receivedData && this.receivedData != this.lastKey){
				this.lastKey = this.receivedData;

				// HATブロックの発火
				setTimeout(() => {
					this.runtime.startHats('f503iExtension_ble_PushKeyAction', {});
					this.lastKey = null;
				}, 0);
			}else{
				return false;
			}
		}

		//取得値をプッシュ文字列に変換
		fsCodeToLetter(xVal){
			const xKeyLabel = ["0","1","2","3","4","5","6","7","8","9","*","#","--"];

			const xData = new Uint8Array(xVal.buffer);
			const n = (xData[1] << 8) | xData[0]; // xData.length == 2

			const xKeyVal = n.toString(2);
			const xCodes = String(xKeyVal).padStart(12, '0')
			const xPos = 11 - xCodes.indexOf("0");
			return xKeyLabel[xPos];
		}


		//BLE書き込み
		async writeBLE(xChar, xVal) {
			const xBuf = new Uint8Array(1);
			xBuf[0] = parseInt(xVal);
			await xChar.writeValueWithoutResponse(xBuf.buffer);
		}


		//ブロック設定
		getInfo() {
			return {
				id: 'f503iExtension',
				name: 'F503i制御ブロック',
				color1 : '#808080', // 背景を黒に
				color2 : '#ffffff', // ブロックリストの円周
				color3 : '#333333', // ブロックの周囲の線
				blocks: [
					{
						opcode: 'connectBLE',
						blockType: Scratch.BlockType.COMMAND,
						text: 'F503iを接続',
						func: 'connect'
					},
					{
						opcode: 'BLEStates',
						blockType: Scratch.BlockType.REPORTER,
						text: 'F503iが接続状況',
						func: 'fsBleStates'
					},
					{
						opcode: 'ble_DisconnecedAction',
						blockType: Scratch.BlockType.HAT,
						text: 'F503iが切断された',
						func: 'fsDisconnectedAction'
					},

					{
						opcode: 'ble_PushKeyAction',
						blockType: Scratch.BlockType.HAT,
						text: 'プッシュキーが押された',
						func: 'fsPushKeyAction'
					},
					{
						opcode: 'getLastKey',
						blockType: Scratch.BlockType.REPORTER,
						text: 'プッシュキー文字',
						func: 'fsGetLastKey'
					},

					{
						opcode: 'ledSwitch',
						blockType: Scratch.BlockType.COMMAND,
						text: '[MODE]のLEDをオン・オフ',
						func: 'fsLedSwitch',
						arguments: {
							MODE: {
								type: Scratch.ArgumentType.STRING,
								menu: 'ledList'
							}
						}
					},
					{
						opcode: 'turnOffLED',
						blockType: Scratch.BlockType.COMMAND,
						text: 'LEDを全て消す',
						func: 'fsTurnOffLED'
					},
					{
						opcode: 'playBuzzer',
						blockType: Scratch.BlockType.COMMAND,
						text: 'ブザーを[SCALE]の音階で鳴らす',
						func: 'fsPlayBuzzer',
						arguments: {
							SCALE: {
								type: Scratch.ArgumentType.NUMBER,
								defaultValue: 61
							}
						}
					},
					{
						opcode: 'stopBuzzer',
						blockType: Scratch.BlockType.COMMAND,
						text: 'ブザーを止める',
						func: 'fsStopBuzzer'
					},
					{
						opcode: 'getBrightness',
						blockType: Scratch.BlockType.REPORTER,
						text: '明るさ',
						func: 'fsGetBrightness'
					},
				],
				menus: {
					ledList: {
						acceptReporters: false,
						items: ['緑', '黄', '赤']
					}
				}
			};
		}

		//BLE切断イベント発火
		fsDisconnectedAction(args, util) {
			if(this.blestates === 2){
				//this.blestates = 0;
				return true;
			}else{
				return false;
			}
		}

		fsBleStates() {
			if(this.blestates === 1){
				return true;
			}else{
				return false;
			}
		}

		//明度センサー値取得
		async fsGetBrightness() {
			try{
				if(this.blestates === 1){
					const xVal = await this.brightness.readValue();
					const n = new Uint8Array(xVal.buffer);
					const xRes = (n[1] << 8) | n[0];
					return xRes;
				}else{
					return -1;
				}
			} catch (error) {
				return -1;
			}
		}

		/*キー入力間監視-------------*/

		//キー入力イベント発火
		fsPushKeyAction(args, util) {
			if(this.lastKey){
				return true;
			}else{
				return false;
			}
		}

		//プッシュキー取得
		fsGetLastKey() {
			return this.receivedData;
		}

		/*LED制御*-------------*/

		//LED On・OFF
		async fsLedSwitch(args) {
			let xTgLabel = null;
			switch(args.MODE){
				case "緑":
					xTgLabel = "_g";
					break;
				case "黄":
					xTgLabel = "_y";
					break;
				case "赤":
					xTgLabel = "_r";
					break;
			}

			const xTgLed = this.ledChars[xTgLabel];
			const xState = this.ledState[xTgLabel];
			this.ledState[xTgLabel] = !xState;
			await this.writeBLE(xTgLed,Number(xState)+1);
		}

		//LED 全消灯
		async fsTurnOffLED(evt){
			await this.writeBLE(this.ledChars._g,2);
			await this.writeBLE(this.ledChars._y,2);
			await this.writeBLE(this.ledChars._r,2);
			this.ledState = {_g:0,_y:0,_r:0};
		}

		/*ブザー制御 -------------*/

		//ブザーを鳴らす
		async fsPlayBuzzer(args){
			await this.writeBLE(this.buzzer ,0);
			let xNum = Math.floor(args.SCALE);
			xNum = Math.max(xNum,0);
			await this.writeBLE(this.buzzer ,xNum);
		}

		//ブザーと止める
		async fsStopBuzzer(){
			await this.writeBLE(this.buzzer ,0);
		}

	}

	Scratch.extensions.register(new BLEExtension());
})(Scratch);
