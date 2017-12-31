'use strict';

let AD2USB = require('ad2usb');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

let Accessory, PlatformAccessory, Characteristic, Service, UUIDGen;

module.exports = function (homebridge) {
    Accessory = homebridge.hap.Accessory;
    PlatformAccessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;

    Characteristic.LCDText = function() {

        Characteristic.call(this, 'Display', 'fd837bd3-a17c-47f0-80c7-59fc24c10e40');
        this.setProps({
            format: Characteristic.Formats.STRING,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
                Characteristic.Perms.WRITE]
        });
        this.value = this.getDefaultValue();
    };

    util.inherits(Characteristic.LCDText, Characteristic);

    Characteristic.LCDText.UUID = 'fd837bd3-a17c-47f0-80c7-59fc24c10e40';

    homebridge.registerPlatform('homebridge-ad2usb', 'AD2USB', AD2USBPlatform, true);
};

class AD2USBPlatform {

    constructor(log, config, api) {


        if ((!config) || (!config.host) || (!config.port) || (!config.pin)) {
            log.warn("Ignoring AD2USB Platform setup because it is not configured");
            this.disabled = true;
            return;
        }

        this.config = config;
        this.api = api;
        this.accessories = {};
        this.log = log;

        this.setupListeners();
    }

    addPartitionAccessory(deviceUUID) {

        let deviceName = this.config.partitionName || "Security System";
        let accessory = new PlatformAccessory(deviceName, deviceUUID);

        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Honeywell/Ademco");

        let securityService = accessory.addService(Service.SecuritySystem, deviceName);
        securityService.addOptionalCharacteristic(Characteristic.LCDText);

        this.accessories[accessory.UUID] = new AD2USBPartitionAccessory(this.log, this.config, accessory, this.ad2usb);
        this.api.registerPlatformAccessories("homebridge-ad2usb", "AD2USB", [accessory]);

    }

    addContactAccessory(deviceUUID, rfContactConfig) {

        let deviceName = rfContactConfig.name;
        let accessory = new PlatformAccessory(deviceName, deviceUUID);

        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Honeywell/Ademco")
            .setCharacteristic(Characteristic.SerialNumber, rfContactConfig.serial + ":" + rfContactConfig.loop);

        let contactSensorService = accessory.addService(Service.ContactSensor, deviceName);
        contactSensorService.addCharacteristic(Characteristic.StatusLowBattery);

        this.accessories[accessory.UUID] = new AD2USBRFContactAccessory(this.log, rfContactConfig, accessory, this.ad2usb);
        this.api.registerPlatformAccessories("homebridge-ad2usb", "AD2USB", [accessory]);

    }

    addMotionSensorAccessory(deviceUUID, rfSensorConfig) {

        let deviceName = rfSensorConfig.name;
        let accessory = new PlatformAccessory(deviceName, deviceUUID);

        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Honeywell/Ademco")
            .setCharacteristic(Characteristic.SerialNumber, rfSensorConfig.serial + ":" + rfSensorConfig.loop);

        let motionSensorService = accessory.addService(Service.MotionSensor, deviceName);
        motionSensorService.addCharacteristic(Characteristic.StatusLowBattery);

        this.accessories[accessory.UUID] = new AD2USBRFMotionSensorAccessory(this.log, rfSensorConfig, accessory, this.ad2usb);
        this.api.registerPlatformAccessories("homebridge-ad2usb", "AD2USB", [accessory]);

    }

    configureAccessory(accessory) {
        this.accessories[accessory.UUID] = accessory;
    }

    setupListeners() {

        this.log("Attempting connection to " + this.config.host + " on port " + this.config.port + "...");
        this.ad2usb = AD2USB.connect(this.config.host, this.config.port, function() {

            this.log("Connected to AD2USB service");

            //////////////////////////
            // Partition

            var uuid = UUIDGen.generate("partition")
            let partitionAccessory = this.accessories[uuid];

            // Add if needed
            if (!partitionAccessory) {
                this.addPartitionAccessory(uuid)
            }
            // ...otherwise restore
            else {
                this.accessories[uuid] = new AD2USBPartitionAccessory(this.log, this.config, (partitionAccessory instanceof AD2USBPartitionAccessory ? partitionAccessory.accessory : partitionAccessory), this.ad2usb);
            }

            //////////////////////////
            // Contact Sensors

            let rfContactsArray = this.config.rfContacts || [];
            rfContactsArray.forEach(function(rfContactConfig) {

                if ((rfContactConfig.serial) && (rfContactConfig.loop) && (rfContactConfig.name)) {

                    this.log("Loading Contact - " + JSON.stringify(rfContactConfig, undefined, 2));
                    uuid = UUIDGen.generate("window:" + rfContactConfig.serial + ":" + rfContactConfig.loop);
                    let contactSensorAccessory = this.accessories[uuid];
                    if (!contactSensorAccessory) {
                        this.addContactAccessory(uuid, rfContactConfig);
                    }
                    else {
                        this.accessories[uuid] = new AD2USBRFContactAccessory(this.log, rfContactConfig, (contactSensorAccessory instanceof AD2USBRFContactAccessory ? contactSensorAccessory.accessory : contactSensorAccessory), this.ad2usb);
                    }

                }
                else {
                    this.log.warn("Invalid Contact in config. Not loading it.");
                }

            }.bind(this))

            //////////////////////////
            // Motion Sensors

            let rfMotionSensorsArray = this.config.rfMotionSensors || [];
            rfMotionSensorsArray.forEach(function(rfMotionSensorConfig) {

                if ((rfMotionSensorConfig.serial) && (rfMotionSensorConfig.loop) && (rfMotionSensorConfig.name)) {

                    this.log("Loading Contact - " + JSON.stringify(rfMotionSensorConfig, undefined, 2));
                    uuid = UUIDGen.generate("window:" + rfMotionSensorConfig.serial + ":" + rfMotionSensorConfig.loop);
                    let motionSensorAccessory = this.accessories[uuid];
                    if (!motionSensorAccessory) {
                        this.addMotionSensorAccessory(uuid, rfMotionSensorConfig);
                    }
                    else {
                        this.accessories[uuid] = new AD2USBRFMotionSensorAccessory(this.log, rfMotionSensorConfig, (motionSensorAccessory instanceof AD2USBRFMotionSensorAccessory ? motionSensorAccessory.accessory : motionSensorAccessory), this.ad2usb);
                    }

                }
                else {
                    this.log.warn("Invalid Contact in config. Not loading it.");
                }

            }.bind(this))


        }.bind(this));

    }
}

class AD2USBPartitionAccessory {

    constructor(log, config, accessory, ad2usb) {

        this.accessory = accessory;
        this.log = log;
        this.ad2usb = ad2usb;
        this.config = config;

        config = config || {};

        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Model, "AD2USB")
            .setCharacteristic(Characteristic.SerialNumber, "DefaultSerial");

        this.setupListeners();
        this.accessory.updateReachability(true);

        this.log("Partition ready to go!");

    }

    setupListeners() {
        this.accessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on('set', this.setTargetState.bind(this));

        // Ready

        // LCD Text
        this.ad2usb.on('lcdtext', function(lcdText) {
            this.log("LCD - " + lcdText);
            this.log("UUID is " + Characteristic.LCDText.UUID);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.LCDText)
                .updateValue(lcdText);

        }.bind(this));

        // Armed Away
        this.ad2usb.on('armedAway', function() {
            this.log("Armed Away");
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.AWAY_ARM);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.AWAY_ARM);
        }.bind(this));

        // Armed Stay
        this.ad2usb.on('armedStay', function() {
            this.log("Armed Stay");
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.STAY_ARM);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.STAY_ARM);
        }.bind(this));

        // Armed Night
        this.ad2usb.on('armedNight', function() {
            this.log("Armed Night");
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.NIGHT_ARM);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
        }.bind(this));

        // Disarmed
        this.ad2usb.on('disarmed', function() {

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.DISARM);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.DISARMED);


        }.bind(this));

    }

    setTargetState(state, callback) {

        switch(state) {
            case Characteristic.SecuritySystemTargetState.AWAY_ARM:
                this.log("Arming Away...");
                this.ad2usb.armAway(this.config.pin);
                callback(null);
                break;
            case Characteristic.SecuritySystemTargetState.DISARM:
                this.log("Disarming...");
                this.ad2usb.disarm(this.config.pin);
                callback(null);
                break;
            case Characteristic.SecuritySystemTargetState.STAY_ARM:
                this.log("Arming Stay...");
                this.ad2usb.armStay(this.config.pin);
                callback(null);
                break;
            case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                this.log("Arming Night...");
                this.ad2usb.armNight(this.config.pin);
                callback(null);
                break;
        }
    }
}

class AD2USBRFContactAccessory {

    constructor(log, config, accessory, ad2usb) {

        this.accessory = accessory;
        this.log = log;
        this.ad2usb = ad2usb;
        this.config = config;

        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Model, "AD2USB")
            .setCharacteristic(Characteristic.SerialNumber, "DefaultSerial");

        this.setupListeners();
        this.accessory.updateReachability(true);

    }

    setupListeners() {

        // Armed Away
        this.ad2usb.on('rfraw', function(serial, supervision, battery, loop1, loop2, loop3, loop4) {

            // Is this for us?
            if (serial == this.config.serial) {

                // Battery
                this.accessory
                    .getService(Service.ContactSensor)
                    .getCharacteristic(Characteristic.StatusLowBattery)
                    .updateValue(battery == true ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);

                // Supervision (ignored)

                // Fault / Clear
                var loopArray = [loop1, loop2, loop3, loop4];
                this.accessory
                    .getService(Service.ContactSensor)
                    .getCharacteristic(Characteristic.ContactSensorState)
                    .updateValue(loopArray[this.config.loop-1] == true ? Characteristic.ContactSensorState.CONTACT_DETECTED: Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);


            }

        }.bind(this));

    }

}

class AD2USBRFMotionSensorAccessory {

    constructor(log, config, accessory, ad2usb) {

        this.accessory = accessory;
        this.log = log;
        this.ad2usb = ad2usb;
        this.config = config;

        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Model, "AD2USB")
            .setCharacteristic(Characteristic.SerialNumber, "DefaultSerial");

        this.setupListeners();
        this.accessory.updateReachability(true);

    }

    setupListeners() {

        // Armed Away
        this.ad2usb.on('rfraw', function(serial, supervision, battery, loop1, loop2, loop3, loop4) {

            // Is this for us?
            if (serial == this.config.serial) {

                // Battery
                this.accessory
                    .getService(Service.MotionSensor)
                    .getCharacteristic(Characteristic.StatusLowBattery)
                    .updateValue(battery == true ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);

                // Supervision (ignored)

                // Fault / Clear
                var loopArray = [loop1, loop2, loop3, loop4];
                this.accessory
                    .getService(Service.MotionSensor)
                    .getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(!loopArray[this.config.loop-1]);


            }

        }.bind(this));

    }

}