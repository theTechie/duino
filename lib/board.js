define(function(require, exports, module) {

var events = require('events'),
    child  = require('child_process'),
    util   = require('util'),
    colors = require('colors'),
    serial = require('serialport');

/*
 * The main Arduino constructor
 * Connect to the serial port and bind
 * @param object options object of option key -> value relations
 * @param function callback function to be called after connection
 */
var Board = function (options, callback) {
  this.log('info', 'initializing');
  this.debug = options && options.debug || false;
  this.writeBuffer = [];
  this.connected = false;

  var self = this;
  this.detect(function (err, serial) {
    if (err) { return callback(new Error('Adruino not found')); }
    self.serial = serial;
    self.emit('connected');
    callback(null, self);

    self.log('info', 'binding serial events');
    self.serial.on('data', function(data){
      if (self.connected == false) {
        self.connected = true;        
        self.emit('ready');
      }

      self.log('receive', data.toString().red);
      self.emit('data', data);
    });

    setTimeout(function() {
      self.log('info', 'board ready');
      self.sendClearingBytes();

      if (self.debug) {
        self.log('info', 'sending debug mode toggle on to board');
        self.write('99' + self.normalizePin(0) + self.normalizeVal(1));
        process.on('SIGINT', function(){
          self.log('info', 'sending debug mode toggle off to board');
          self.write('99' + self.normalizePin(0) + self.normalizeVal(0));
          delete self.serial;
          setTimeout(function(){
            process.exit();
          }, 100);
        });
      }

      if (self.writeBuffer.length > 0) {
        self.processWriteBuffer();
      }
      
      self.IAmDave();
      setTimeout(function() {self.IAmDave();}, 500);
      // self.emit('ready');
    }, 500);
  });
}

/*
 * EventEmitter, I choose you!
 */
util.inherits(Board, events.EventEmitter);

/*
 * Detect an Arduino board
 * Loop through all USB devices and try to connect
 * This should really message the device and wait for a correct response
 */
Board.prototype.detect = function (cb) {
  this.log('info', 'attempting to find Arduino board');
  var self = this;
  child.exec('ls /dev | grep -E "usb|ttyACM"', function(err, stdout, stderr){
    var possible = stdout.slice(0, -1).split('\n'),
        found = false;
    for (var i in possible) {
      var tempSerial, err;
      try {
        tempSerial = new serial.SerialPort('/dev/' + possible[i], {
          baudrate: 115200,
          parser: serial.parsers.readline("\n")
        });
      } catch (e) {
        err = e;
      }
      if (!err) {
        found = tempSerial;
        self.log('info', 'found board at ' + tempSerial.port);
        break;
      }
    }
    if (found) cb(null, found);
    else cb(new Error('Could not find Arduino'));
  });
}

/*
 * The board will eat the first 4 bytes of the session
 * So we give it crap to eat
 */
Board.prototype.sendClearingBytes = function () {
  this.serial.write('00000000');
}

Board.prototype.IAmDave = function() {
  this.log('info', 'I\'m Dave!');
  this.serial.write('90000000');  
  this.write('90000000');
}

/*
 * Process the writeBuffer (messages attempted before serial was ready)
 */
Board.prototype.processWriteBuffer = function () {
  this.log('info', 'processing buffered messages');
  while (this.writeBuffer.length > 0) {
    this.log('info', 'writing buffered message');
    this.write(this.writeBuffer.shift());
  }
}

/*
 * Low-level serial write
 */
Board.prototype.write = function (m) {
  if (this.serial) {
    this.log('write', m);
    this.serial.write('!' + m + '.');
  } else {
    this.log('info', 'serial not ready, buffering message: ' + m.red);
    this.writeBuffer.push(m);
  }
}

/*
 * Add a 0 to the front of a single-digit pin number
 */
Board.prototype.normalizePin = function (pin) {
  return ("00" + pin).substr(-2);
	/*pin = String(pin).split('');
  if (pin.length > 1) {
    return pin.join('');
  } else {
    pin.unshift('0');
    return pin.join('');
  }*/
}

Board.prototype.normalizeVal = function(val) {
	return ("000" + val).substr(-3);
}

/*
 * Define constants
 */
Board.prototype.HIGH = '255';
Board.prototype.LOW = '000';

/*
 * Set a pin's mode
 * val == out = 001
 * val == in  = 000
 */
Board.prototype.pinMode = function (pin, val, callback) {
  pin = this.normalizePin(pin);
  this.log('info', 'set pin ' + pin + ' mode to ' + val);
  val = (
    val == 'out' ?
    this.normalizeVal(1) :
    this.normalizeVal(0)
  );
  this.write('00' + pin + val);
}

/*
 * Tell the board to write to a digital pin
 */
Board.prototype.digitalWrite = function (pin, val) {
  pin = this.normalizePin(pin);
  val = this.normalizeVal(val);
  this.log('info', 'digitalWrite to pin ' + pin + ': ' + val.green);
  this.write('01' + pin + val);
}

/*
 * Tell the board to extract data from a pin
 */
Board.prototype.digitalRead = function (pin) {
  pin = this.normalizePin(pin);
  this.log('info', 'digitalRead from pin ' + pin);
  this.write('02' + pin + this.normalizeVal(0));
}

Board.prototype.analogWrite = function (pin, val) {
	pin = this.normalizePin(pin);
	val = this.normalizeVal(val);
	this.log('info', 'analogWrite to pin ' + pin + ': ' + val.green);
	this.write('03' + pin + val);
}

Board.prototype.analogRead = function (pin) {
	pin = this.normalizePin(pin);
	this.log('info', 'analogRead from pin ' + pin);
	this.write('04' + pin + this.normalizeVal(0));
}

/*
 * Utility function to pause for a given time
 */
Board.prototype.delay = function (ms) {
  ms += +new Date();
  while (+new Date() < ms) { }
} 

/*
 * Logger utility function
 */
Board.prototype.log = function (level, message) {
  if (this.debug) {
    console.log(String(+new Date()).grey + ' duino '.blue + level.magenta + ' ' + message);
  }
}

return Board;
});