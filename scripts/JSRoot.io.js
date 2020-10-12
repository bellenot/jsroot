/// @file JSRoot.io.js
/// I/O methods of JavaScript ROOT

JSROOT.require(['rawinflate'], () => {

   "use strict";

   let jsrio = {
      kBase: 0, kOffsetL: 20, kOffsetP: 40,
      kChar: 1, kShort: 2, kInt: 3, kLong: 4, kFloat: 5, kCounter: 6, kCharStar: 7, kDouble: 8, kDouble32: 9, kLegacyChar: 10,
      kUChar: 11, kUShort: 12, kUInt: 13, kULong: 14, kBits: 15, kLong64: 16, kULong64: 17, kBool: 18, kFloat16: 19,
      kObject: 61, kAny: 62, kObjectp: 63, kObjectP: 64, kTString: 65,
      kTObject: 66, kTNamed: 67, kAnyp: 68, kAnyP: 69, kAnyPnoVT: 70, kSTLp: 71,
      kSkip: 100, kSkipL: 120, kSkipP: 140, kConv: 200, kConvL: 220, kConvP: 240,
      kSTL: 300, kSTLstring: 365, kStreamer: 500, kStreamLoop: 501,
      kMapOffset: 2,
      kByteCountMask: 0x40000000,
      kNewClassTag: 0xFFFFFFFF,
      kClassMask: 0x80000000,
      Mode: "array", // could be string or array, enable usage of ArrayBuffer in http requests
      NativeArray: true, // when true, native arrays like Int32Array or Float64Array are used

      TypeNames: ["BASE", "char", "short", "int", "long", "float", "int", "const char*", "double", "Double32_t",
         "char", "unsigned  char", "unsigned short", "unsigned", "unsigned long", "unsigned", "Long64_t", "ULong64_t", "bool", "Float16_t"],

      // constants used for coding type of STL container
      kNotSTL: 0, kSTLvector: 1, kSTLlist: 2, kSTLdeque: 3, kSTLmap: 4, kSTLmultimap: 5,
      kSTLset: 6, kSTLmultiset: 7, kSTLbitset: 8, kSTLforwardlist: 9,
      kSTLunorderedset: 10, kSTLunorderedmultiset: 11, kSTLunorderedmap: 12,
      kSTLunorderedmultimap: 13, kSTLend: 14,

      // names of STL containers
      StlNames: ["", "vector", "list", "deque", "map", "multimap", "set", "multiset", "bitset"],

      // constants of bits in version
      kStreamedMemberWise: JSROOT.BIT(14),

      kSplitCollectionOfPointers: 100,

      // map of user-streamer function like func(buf,obj)
      // or alias (classname) which can be used to read that function
      // or list of read functions
      CustomStreamers: {},

      // these are streamers which do not handle version regularly
      // used for special classes like TRef or TBasket
      DirectStreamers: {},

      // TObject bits
      kIsReferenced: JSROOT.BIT(4),
      kHasUUID: JSROOT.BIT(5),

      IsInteger: function(typ) {
         return ((typ >= this.kChar) && (typ <= this.kLong)) || (typ === this.kCounter) ||
            ((typ >= this.kLegacyChar) && (typ <= this.kBool));
      },

      IsNumeric: function(typ) { return (typ > 0) && (typ <= this.kBool) && (typ !== this.kCharStar); },

      GetTypeId: function(typname, norecursion) {
         switch (typname) {
            case "bool":
            case "Bool_t": return jsrio.kBool;
            case "char":
            case "signed char":
            case "Char_t": return jsrio.kChar;
            case "Color_t":
            case "Style_t":
            case "Width_t":
            case "short":
            case "Short_t": return jsrio.kShort;
            case "int":
            case "EErrorType":
            case "Int_t": return jsrio.kInt;
            case "long":
            case "Long_t": return jsrio.kLong;
            case "float":
            case "Float_t": return jsrio.kFloat;
            case "double":
            case "Double_t": return jsrio.kDouble;
            case "unsigned char":
            case "UChar_t": return jsrio.kUChar;
            case "unsigned short":
            case "UShort_t": return jsrio.kUShort;
            case "unsigned":
            case "unsigned int":
            case "UInt_t": return jsrio.kUInt;
            case "unsigned long":
            case "ULong_t": return jsrio.kULong;
            case "int64_t":
            case "long long":
            case "Long64_t": return jsrio.kLong64;
            case "uint64_t":
            case "unsigned long long":
            case "ULong64_t": return jsrio.kULong64;
            case "Double32_t": return jsrio.kDouble32;
            case "Float16_t": return jsrio.kFloat16;
            case "char*":
            case "const char*":
            case "const Char_t*": return jsrio.kCharStar;
         }

         if (!norecursion) {
            let replace = jsrio.CustomStreamers[typname];
            if (typeof replace === "string") return jsrio.GetTypeId(replace, true);
         }

         return -1;
      },

      GetTypeSize: function(typname) {
         switch (typname) {
            case jsrio.kBool: return 1;
            case jsrio.kChar: return 1;
            case jsrio.kShort: return 2;
            case jsrio.kInt: return 4;
            case jsrio.kLong: return 8;
            case jsrio.kFloat: return 4;
            case jsrio.kDouble: return 8;
            case jsrio.kUChar: return 1;
            case jsrio.kUShort: return 2;
            case jsrio.kUInt: return 4;
            case jsrio.kULong: return 8;
            case jsrio.kLong64: return 8;
            case jsrio.kULong64: return 8;
         }
         return -1;
      },

      AddClassMethods: function(clname, streamer) {
         // create additional entries in the streamer, which sets all methods of the class

         if (streamer === null) return streamer;

         let methods = JSROOT.getMethods(clname);

         if (methods !== null)
            for (let key in methods)
               if ((typeof methods[key] === 'function') || (key.indexOf("_") == 0))
                  streamer.push({
                     name: key,
                     method: methods[key],
                     func: function(buf, obj) { obj[this.name] = this.method; }
                  });

         return streamer;
      },

      GetArrayKind: function(type_name) {
         // returns type of array
         // 0 - if TString (or equivalent)
         // -1 - if any other kind
         if ((type_name === "TString") || (type_name === "string") ||
            (jsrio.CustomStreamers[type_name] === 'TString')) return 0;
         if ((type_name.length < 7) || (type_name.indexOf("TArray") !== 0)) return -1;
         if (type_name.length == 7)
            switch (type_name[6]) {
               case 'I': return jsrio.kInt;
               case 'D': return jsrio.kDouble;
               case 'F': return jsrio.kFloat;
               case 'S': return jsrio.kShort;
               case 'C': return jsrio.kChar;
               case 'L': return jsrio.kLong;
               default: return -1;
            }

         return type_name == "TArrayL64" ? jsrio.kLong64 : -1;
      }

   }

   /** Add custom streamer
     * @private */
   JSROOT.addUserStreamer = function(type, user_streamer) {
      jsrio.CustomStreamers[type] = user_streamer;
   }

   /** Reads header envelope, determines zipped size and unzip content
     * @private */
   JSROOT.R__unzip = function(arr, tgtsize, noalert, src_shift) {

      const HDRSIZE = 9, totallen = arr.byteLength;
      let curr = src_shift || 0, fullres = 0, tgtbuf = null,
          getChar = o => String.fromCharCode(arr.getUint8(o)),
          getCode = o => arr.getUint8(o);

      while (fullres < tgtsize) {

         let fmt = "unknown", off = 0, CHKSUM = 0;

         if (curr + HDRSIZE >= totallen) {
            if (!noalert) console.error("Error R__unzip: header size exceeds buffer size");
            return null;
         }

         if (getChar(curr) == 'Z' && getChar(curr + 1) == 'L' && getCode(curr + 2) == 8) { fmt = "new"; off = 2; } else
         if (getChar(curr) == 'C' && getChar(curr + 1) == 'S' && getCode(curr + 2) == 8) { fmt = "old"; off = 0; } else
         if (getChar(curr) == 'X' && getChar(curr + 1) == 'Z') fmt = "LZMA"; else
         if (getChar(curr) == 'L' && getChar(curr + 1) == '4') { fmt = "LZ4"; off = 0; CHKSUM = 8; }

         /*   C H E C K   H E A D E R   */
         if ((fmt !== "new") && (fmt !== "old") && (fmt !== "LZ4")) {
            if (!noalert) console.error(`R__unzip: ${fmt} format is not supported!`);
            return null;
         }

         const srcsize = HDRSIZE + ((getCode(curr + 3) & 0xff) | ((getCode(curr + 4) & 0xff) << 8) | ((getCode(curr + 5) & 0xff) << 16));

         let uint8arr = new Uint8Array(arr.buffer, arr.byteOffset + curr + HDRSIZE + off + CHKSUM, Math.min(arr.byteLength - curr - HDRSIZE - off - CHKSUM, srcsize - HDRSIZE - CHKSUM));

         //  place for unpacking
         if (!tgtbuf) tgtbuf = new ArrayBuffer(tgtsize);

         let tgt8arr = new Uint8Array(tgtbuf, fullres);

         const reslen = (fmt === "LZ4") ? JSROOT.LZ4.uncompress(uint8arr, tgt8arr) : JSROOT.ZIP.inflate(uint8arr, tgt8arr);
         if (reslen <= 0) break;

         fullres += reslen;
         curr += srcsize;
      }

      if (fullres !== tgtsize) {
         if (!noalert) console.error(`R__unzip: fail to unzip data expects ${tgtsize} , got ${fullres}`);
         return null;
      }

      return new DataView(tgtbuf);
   }

   // =================================================================================

   function TBuffer(arr, pos, file, length) {
      // buffer takes with DataView as first argument
      this._typename = "TBuffer";
      this.arr = arr;
      this.o = pos || 0;
      this.fFile = file;
      this.length = length || (arr ? arr.byteLength : 0); // use size of array view, blob buffer can be much bigger
      this.ClearObjectMap();
      this.fTagOffset = 0;
      this.last_read_version = 0;
   }

   TBuffer.prototype.locate = function(pos) { this.o = pos; }
   TBuffer.prototype.shift = function(cnt) { this.o += cnt; }
   TBuffer.prototype.remain = function() { return this.length - this.o; }
   TBuffer.prototype.GetMappedObject = function(tag) { return this.fObjectMap[tag]; }
   TBuffer.prototype.MapObject = function(tag, obj) { if (obj !== null) this.fObjectMap[tag] = obj; }
   TBuffer.prototype.MapClass = function(tag, classname) { this.fClassMap[tag] = classname; }
   TBuffer.prototype.GetMappedClass = function(tag) { return (tag in this.fClassMap) ? this.fClassMap[tag] : -1; }

   TBuffer.prototype.ClearObjectMap = function() {
      this.fObjectMap = {};
      this.fClassMap = {};
      this.fObjectMap[0] = null;
      this.fDisplacement = 0;
   }

   TBuffer.prototype.ReadVersion = function() {
      // read class version from I/O buffer
      let ver = {}, bytecnt = this.ntou4(); // byte count

      if (bytecnt & jsrio.kByteCountMask)
         ver.bytecnt = bytecnt - jsrio.kByteCountMask - 2; // one can check between Read version and end of streamer
      else
         this.o -= 4; // rollback read bytes, this is old buffer without byte count

      this.last_read_version = ver.val = this.ntoi2();
      this.last_read_checksum = 0;
      ver.off = this.o;

      if ((ver.val <= 0) && ver.bytecnt && (ver.bytecnt >= 4)) {
         ver.checksum = this.ntou4();
         if (!this.fFile.FindSinfoCheckum(ver.checksum)) {
            // console.error(`Fail to find streamer info with check sum ${ver.checksum} version ${ver.val}`);
            this.o -= 4; // not found checksum in the list
            delete ver.checksum; // remove checksum
         } else {
            this.last_read_checksum = ver.checksum;
         }
      }
      return ver;
   }

   TBuffer.prototype.CheckBytecount = function(ver, where) {
      if ((ver.bytecnt !== undefined) && (ver.off + ver.bytecnt !== this.o)) {
         if (where) {
            // alert("Missmatch in " + where + " bytecount expected = " + ver.bytecnt + "  got = " + (this.o-ver.off));
            console.log("Missmatch in " + where + " bytecount expected = " + ver.bytecnt + "  got = " + (this.o - ver.off));
         }
         this.o = ver.off + ver.bytecnt;
         return false;
      }
      return true;
   }

   TBuffer.prototype.ReadTString = function() {
      // stream a TString object from buffer
      // std::string uses similar binary format
      let len = this.ntou1();
      // large strings
      if (len == 255) len = this.ntou4();
      if (len == 0) return "";

      const pos = this.o;
      this.o += len;

      return (this.codeAt(pos) == 0) ? '' : this.substring(pos, pos + len);
   }

   TBuffer.prototype.ReadFastString = function(n) {
      // read Char_t array as string
      // string either contains all symbols or until 0 symbol

      let res = "", code, closed = false;
      for (let i = 0; (n < 0) || (i < n); ++i) {
         code = this.ntou1();
         if (code == 0) { closed = true; if (n < 0) break; }
         if (!closed) res += String.fromCharCode(code);
      }

      return res;
   }

   TBuffer.prototype.ntou1 = function() {
      return this.arr.getUint8(this.o++);
   }

   TBuffer.prototype.ntou2 = function() {
      const o = this.o; this.o += 2;
      return this.arr.getUint16(o);
   }

   TBuffer.prototype.ntou4 = function() {
      const o = this.o; this.o += 4;
      return this.arr.getUint32(o);
   }

   TBuffer.prototype.ntou8 = function() {
      const high = this.arr.getUint32(this.o); this.o += 4;
      const low = this.arr.getUint32(this.o); this.o += 4;
      return high * 0x100000000 + low;
   }

   TBuffer.prototype.ntoi1 = function() {
      return this.arr.getInt8(this.o++);
   }

   TBuffer.prototype.ntoi2 = function() {
      const o = this.o; this.o += 2;
      return this.arr.getInt16(o);
   }

   TBuffer.prototype.ntoi4 = function() {
      const o = this.o; this.o += 4;
      return this.arr.getInt32(o);
   }

   TBuffer.prototype.ntoi8 = function() {
      const high = this.arr.getUint32(this.o); this.o += 4;
      const low = this.arr.getUint32(this.o); this.o += 4;
      if (high < 0x80000000) return high * 0x100000000 + low;
      return -1 - ((~high) * 0x100000000 + ~low);
   }

   TBuffer.prototype.ntof = function() {
      const o = this.o; this.o += 4;
      return this.arr.getFloat32(o);
   }

   TBuffer.prototype.ntod = function() {
      const o = this.o; this.o += 8;
      return this.arr.getFloat64(o);
   }

   /** Reads array of n values from the I/O buffer */
   TBuffer.prototype.ReadFastArray = function(n, array_type) {
      let array, i = 0, o = this.o, view = this.arr;
      switch (array_type) {
         case jsrio.kDouble:
            array = new Float64Array(n);
            for (; i < n; ++i, o += 8)
               array[i] = view.getFloat64(o);
            break;
         case jsrio.kFloat:
            array = new Float32Array(n);
            for (; i < n; ++i, o += 4)
               array[i] = view.getFloat32(o);
            break;
         case jsrio.kLong:
         case jsrio.kLong64:
            array = new Float64Array(n);
            for (; i < n; ++i)
               array[i] = this.ntoi8();
            return array; // exit here to avoid conflicts
         case jsrio.kULong:
         case jsrio.kULong64:
            array = new Float64Array(n);
            for (; i < n; ++i)
               array[i] = this.ntou8();
            return array; // exit here to avoid conflicts
         case jsrio.kInt:
         case jsrio.kCounter:
            array = new Int32Array(n);
            for (; i < n; ++i, o += 4)
               array[i] = view.getInt32(o);
            break;
         case jsrio.kBits:
         case jsrio.kUInt:
            array = new Uint32Array(n);
            for (; i < n; ++i, o += 4)
               array[i] = view.getUint32(o);
            break;
         case jsrio.kShort:
            array = new Int16Array(n);
            for (; i < n; ++i, o += 2)
               array[i] = view.getInt16(o);
            break;
         case jsrio.kUShort:
            array = new Uint16Array(n);
            for (; i < n; ++i, o += 2)
               array[i] = view.getUint16(o);
            break;
         case jsrio.kChar:
            array = new Int8Array(n);
            for (; i < n; ++i)
               array[i] = view.getInt8(o++);
            break;
         case jsrio.kBool:
         case jsrio.kUChar:
            array = new Uint8Array(n);
            for (; i < n; ++i)
               array[i] = view.getUint8(o++);
            break;
         case jsrio.kTString:
            array = new Array(n);
            for (; i < n; ++i)
               array[i] = this.ReadTString();
            return array; // exit here to avoid conflicts
         case jsrio.kDouble32:
            throw new Error('kDouble32 should not be used in ReadFastArray');
         case jsrio.kFloat16:
            throw new Error('kFloat16 should not be used in ReadFastArray');
         default:
            array = new Uint32Array(n);
            for (; i < n; ++i, o += 4)
               array[i] = view.getUint32(o);
            break;
      }

      this.o = o;

      return array;
   }

   TBuffer.prototype.can_extract = function(place) {
      for (let n = 0; n < place.length; n += 2)
         if (place[n] + place[n + 1] > this.length) return false;
      return true;
   }

   TBuffer.prototype.extract = function(place) {
      if (!this.arr || !this.arr.buffer || !this.can_extract(place)) return null;
      if (place.length === 2) return new DataView(this.arr.buffer, this.arr.byteOffset + place[0], place[1]);

      let res = new Array(place.length / 2);

      for (let n = 0; n < place.length; n += 2)
         res[n / 2] = new DataView(this.arr.buffer, this.arr.byteOffset + place[n], place[n + 1]);

      return res; // return array of buffers
   }

   TBuffer.prototype.codeAt = function(pos) {
      return this.arr.getUint8(pos);
   }

   TBuffer.prototype.substring = function(beg, end) {
      let res = "";
      for (let n = beg; n < end; ++n)
         res += String.fromCharCode(this.arr.getUint8(n));
      return res;
   }

   TBuffer.prototype.ReadNdimArray = function(handle, func) {
      let ndim = handle.fArrayDim, maxindx = handle.fMaxIndex, res;
      if ((ndim < 1) && (handle.fArrayLength > 0)) { ndim = 1; maxindx = [handle.fArrayLength]; }
      if (handle.minus1) --ndim;

      if (ndim < 1) return func(this, handle);

      if (ndim === 1) {
         res = new Array(maxindx[0]);
         for (let n = 0; n < maxindx[0]; ++n)
            res[n] = func(this, handle);
      } else if (ndim === 2) {
         res = new Array(maxindx[0]);
         for (let n = 0; n < maxindx[0]; ++n) {
            let res2 = new Array(maxindx[1]);
            for (let k = 0; k < maxindx[1]; ++k)
               res2[k] = func(this, handle);
            res[n] = res2;
         }
      } else {
         let indx = [], arr = [], k;
         for (k = 0; k < ndim; ++k) { indx[k] = 0; arr[k] = []; }
         res = arr[0];
         while (indx[0] < maxindx[0]) {
            k = ndim - 1;
            arr[k].push(func(this, handle));
            ++indx[k];
            while ((indx[k] === maxindx[k]) && (k > 0)) {
               indx[k] = 0;
               arr[k - 1].push(arr[k]);
               arr[k] = [];
               ++indx[--k];
            }
         }
      }

      return res;
   }

   TBuffer.prototype.ReadTKey = function(key) {
      if (!key) key = {};
      this.ClassStreamer(key, 'TKey');
      let name = key.fName.replace(/['"]/g, '');
      if (name !== key.fName) {
         key.fRealName = key.fName;
         key.fName = name;
      }
      return key;
   }

   TBuffer.prototype.ReadBasketEntryOffset = function(basket, offset) {
      // this is remaining part of TBasket streamer to decode fEntryOffset
      // after unzipping of the TBasket data

      this.locate(basket.fLast - offset);

      if (this.remain() <= 0) {
         if (!basket.fEntryOffset && (basket.fNevBuf <= 1)) basket.fEntryOffset = [basket.fKeylen];
         if (!basket.fEntryOffset) console.warn("No fEntryOffset when expected for basket with", basket.fNevBuf, "entries");
         return;
      }

      const nentries = this.ntoi4();
      // there is error in file=reco_103.root&item=Events;2/PCaloHits_g4SimHits_EcalHitsEE_Sim.&opt=dump;num:10;first:101
      // it is workaround, but normally I/O should fail here
      if ((nentries < 0) || (nentries > this.remain() * 4)) {
         console.error("Error when reading entries offset from basket fNevBuf", basket.fNevBuf, "remains", this.remain(), "want to read", nentries);
         if (basket.fNevBuf <= 1) basket.fEntryOffset = [basket.fKeylen];
         return;
      }

      basket.fEntryOffset = this.ReadFastArray(nentries, jsrio.kInt);
      if (!basket.fEntryOffset) basket.fEntryOffset = [basket.fKeylen];

      if (this.remain() > 0)
         basket.fDisplacement = this.ReadFastArray(this.ntoi4(), jsrio.kInt);
      else
         basket.fDisplacement = undefined;
   }

   TBuffer.prototype.ReadClass = function() {
      // read class definition from I/O buffer
      let classInfo = { name: -1 }, tag = 0, bcnt = this.ntou4();
      const startpos = this.o;

      if (!(bcnt & jsrio.kByteCountMask) || (bcnt == jsrio.kNewClassTag)) {
         tag = bcnt;
         bcnt = 0;
      } else {
         tag = this.ntou4();
      }
      if (!(tag & jsrio.kClassMask)) {
         classInfo.objtag = tag + this.fDisplacement; // indicate that we have deal with objects tag
         return classInfo;
      }
      if (tag == jsrio.kNewClassTag) {
         // got a new class description followed by a new object
         classInfo.name = this.ReadFastString(-1);

         if (this.GetMappedClass(this.fTagOffset + startpos + jsrio.kMapOffset) === -1)
            this.MapClass(this.fTagOffset + startpos + jsrio.kMapOffset, classInfo.name);
      } else {
         // got a tag to an already seen class
         const clTag = (tag & ~jsrio.kClassMask) + this.fDisplacement;
         classInfo.name = this.GetMappedClass(clTag);

         if (classInfo.name === -1)
            console.error(`Did not found class with tag ${clTag}`);
      }

      return classInfo;
   }

   TBuffer.prototype.ReadObjectAny = function() {
      const objtag = this.fTagOffset + this.o + jsrio.kMapOffset,
            clRef = this.ReadClass();

      // class identified as object and should be handled so
      if ('objtag' in clRef)
         return this.GetMappedObject(clRef.objtag);

      if (clRef.name === -1) return null;

      const arrkind = jsrio.GetArrayKind(clRef.name);
      let obj;

      if (arrkind === 0) {
         obj = this.ReadTString();
      } else if (arrkind > 0) {
         // reading array, can map array only afterwards
         obj = this.ReadFastArray(this.ntou4(), arrkind);
         this.MapObject(objtag, obj);
      } else {
         // reading normal object, should map before to
         obj = {};
         this.MapObject(objtag, obj);
         this.ClassStreamer(obj, clRef.name);
      }

      return obj;
   }

   TBuffer.prototype.ClassStreamer = function(obj, classname) {

      if (obj._typename === undefined) obj._typename = classname;

      let direct = jsrio.DirectStreamers[classname];
      if (direct) {
         direct(this, obj);
         return obj;
      }

      const ver = this.ReadVersion();

      let streamer = this.fFile.GetStreamer(classname, ver);

      if (streamer !== null) {

         for (let n = 0; n < streamer.length; ++n)
            streamer[n].func(this, obj);

      } else {
         // just skip bytes belonging to not-recognized object
         // console.warn('skip object ', classname);

         JSROOT.addMethods(obj);
      }

      this.CheckBytecount(ver, classname);

      return obj;
   }

   // ==============================================================================

   // A class that reads a TDirectory from a buffer.

   // ctor
   function TDirectory(file, dirname, cycle) {
      this.fFile = file;
      this._typename = "TDirectory";
      this.dir_name = dirname;
      this.dir_cycle = cycle;
      this.fKeys = [];
   }

   TDirectory.prototype.GetKey = function(keyname, cycle, only_direct) {
      // retrieve a key by its name and cycle in the list of keys

      if (typeof cycle != 'number') cycle = -1;
      let bestkey = null;
      for (let i = 0; i < this.fKeys.length; ++i) {
         let key = this.fKeys[i];
         if (!key || (key.fName!==keyname)) continue;
         if (key.fCycle == cycle) { bestkey = key; break; }
         if ((cycle < 0) && (!bestkey || (key.fCycle > bestkey.fCycle))) bestkey = key;
      }
      if (bestkey)
         return only_direct ? bestkey : Promise.resolve(bestkey);

      let pos = keyname.lastIndexOf("/");
      // try to handle situation when object name contains slashed (bad practice anyway)
      while (pos > 0) {
         let dirname = keyname.substr(0, pos),
             subname = keyname.substr(pos+1),
             dirkey = this.GetKey(dirname, undefined, true);

         if (dirkey && !only_direct && (dirkey.fClassName.indexOf("TDirectory")==0))
            return this.fFile.ReadObject(this.dir_name + "/" + dirname, 1)
                             .then(newdir => newdir.GetKey(subname, cycle));

         pos = keyname.lastIndexOf("/", pos-1);
      }

      return only_direct ? null : Promise.reject(Error("Key not found " + keyname));
   }

   TDirectory.prototype.ReadObject = function(obj_name, cycle) {
      return this.fFile.ReadObject(this.dir_name + "/" + obj_name, cycle);
   }

   TDirectory.prototype.ReadKeys = function(objbuf) {

      objbuf.ClassStreamer(this, 'TDirectory');

      if ((this.fSeekKeys <= 0) || (this.fNbytesKeys <= 0))
         return Promise.resolve(this);

      let file = this.fFile;

      return file.ReadBuffer([this.fSeekKeys, this.fNbytesKeys]).then(blob => {
         //*-* -------------Read keys of the top directory

         let buf = new TBuffer(blob, 0, file);

         buf.ReadTKey();
         const nkeys = buf.ntoi4();

         for (let i = 0; i < nkeys; ++i)
            this.fKeys.push(buf.ReadTKey());

         file.fDirectories.push(this);

         return this;
      });
   }

   /** @class TFile
     * @summary Interface to read objects from ROOT files
     * @memberOf JSROOT
     * @constructor
     * @desc Use {@link JSROOT.openFile} to create instance of the class */

   function TFile(url) {
      this._typename = "TFile";
      this.fEND = 0;
      this.fFullURL = url;
      this.fURL = url;
      this.fAcceptRanges = true; // when disabled ('+' at the end of file name), complete file content read with single operation
      this.fUseStampPar = "stamp=" + (new Date).getTime(); // use additional time stamp parameter for file name to avoid browser caching problem
      this.fFileContent = null; // this can be full or partial content of the file (if ranges are not supported or if 1K header read from file)
      // stored as TBuffer instance
      this.fMaxRanges = 200; // maximal number of file ranges requested at once
      this.fDirectories = [];
      this.fKeys = [];
      this.fSeekInfo = 0;
      this.fNbytesInfo = 0;
      this.fTagOffset = 0;
      this.fStreamers = 0;
      this.fStreamerInfos = null;
      this.fFileName = "";
      this.fStreamers = [];
      this.fBasicTypes = {}; // custom basic types, in most case enumerations

      if (typeof this.fURL != 'string') return this;

      if (this.fURL[this.fURL.length - 1] === "+") {
         this.fURL = this.fURL.substr(0, this.fURL.length - 1);
         this.fAcceptRanges = false;
      }

      if (this.fURL[this.fURL.length - 1] === "-") {
         this.fURL = this.fURL.substr(0, this.fURL.length - 1);
         this.fUseStampPar = false;
      }

      if (this.fURL.indexOf("file://") == 0) {
         this.fUseStampPar = false;
         this.fAcceptRanges = false;
      }

      const pos = Math.max(this.fURL.lastIndexOf("/"), this.fURL.lastIndexOf("\\"));
      this.fFileName = pos >= 0 ? this.fURL.substr(pos + 1) : this.fURL;
   }

   /** @summary Open file
    * @returns {Promise} after file keys are read
    * @private */
   TFile.prototype.Open = function() {
      if (!this.fAcceptRanges)
         return this.ReadKeys();

      return JSROOT.httpRequest(this.fURL, "head").then(res => {
         const accept_ranges = res.getResponseHeader("Accept-Ranges");
         if (!accept_ranges) this.fAcceptRanges = false;
         const len = res.getResponseHeader("Content-Length");
         if (len) this.fEND = parseInt(len);
             else this.fAcceptRanges = false;
         return this.ReadKeys();
      });
   }

   /** @summary read buffer(s) from the file
    * @returns {Promise} with read buffers
    * @private */
   TFile.prototype.ReadBuffer = function(place, filename, progress_callback) {

      if ((this.fFileContent !== null) && !filename && (!this.fAcceptRanges || this.fFileContent.can_extract(place)))
         return Promise.resolve(this.fFileContent.extract(place));

      let file = this, fileurl = file.fURL, resolveFunc, rejectFunc,
          promise = new Promise((resolve,reject) => { resolveFunc = resolve; rejectFunc = reject; }),
          first = 0, last = 0, blobs = [], read_callback; // array of requested segments

      if (filename && (typeof filename === 'string') && (filename.length > 0)) {
         const pos = fileurl.lastIndexOf("/");
         fileurl = (pos < 0) ? filename : fileurl.substr(0, pos + 1) + filename;
      }

      function send_new_request(increment) {

         if (increment) {
            first = last;
            last = Math.min(first + file.fMaxRanges * 2, place.length);
            if (first >= place.length) return resolveFunc(blobs);
         }

         let fullurl = fileurl, ranges = "bytes", totalsz = 0;
         // try to avoid browser caching by adding stamp parameter to URL
         if (file.fUseStampPar) fullurl += ((fullurl.indexOf('?') < 0) ? "?" : "&") + file.fUseStampPar;

         for (let n = first; n < last; n += 2) {
            ranges += (n > first ? "," : "=") + (place[n] + "-" + (place[n] + place[n + 1] - 1));
            totalsz += place[n + 1]; // accumulated total size
         }
         if (last - first > 2) totalsz += (last - first) * 60; // for multi-range ~100 bytes/per request

         let xhr = JSROOT.NewHttpRequest(fullurl, "buf", read_callback);

         if (file.fAcceptRanges) {
            xhr.setRequestHeader("Range", ranges);
            xhr.expected_size = Math.max(Math.round(1.1 * totalsz), totalsz + 200); // 200 if offset for the potential gzip
         }

         if (progress_callback && (typeof xhr.addEventListener === 'function')) {
            let sum1 = 0, sum2 = 0, sum_total = 0;
            for (let n = 1; n < place.length; n += 2) {
               sum_total += place[n];
               if (n < first) sum1 += place[n];
               if (n < last) sum2 += place[n];
            }
            if (!sum_total) sum_total = 1;

            let progress_offest = sum1 / sum_total, progress_this = (sum2 - sum1) / sum_total;
            xhr.addEventListener("progress", function(oEvent) {
               if (oEvent.lengthComputable)
                  progress_callback(progress_offest + progress_this * oEvent.loaded / oEvent.total);
            });
         }

         xhr.send(null);
      }

      read_callback = function(res) {

         if (!res && file.fUseStampPar && (place[0] === 0) && (place.length === 2)) {
            // if fail to read file with stamp parameter, try once again without it
            file.fUseStampPar = false;
            return send_new_request();
         }

         if (res && (place[0] === 0) && (place.length === 2) && !file.fFileContent) {
            // special case - keep content of first request (could be complete file) in memory

            file.fFileContent = new TBuffer((typeof res == 'string') ? res : new DataView(res));

            if (!file.fAcceptRanges)
               file.fEND = file.fFileContent.length;

            return resolveFunc(file.fFileContent.extract(place));
         }

         if (!res) {
            if ((first === 0) && (last > 2) && (file.fMaxRanges > 1)) {
               // server return no response with multi request - try to decrease ranges count or fail

               if (last / 2 > 200) file.fMaxRanges = 200; else
                  if (last / 2 > 50) file.fMaxRanges = 50; else
                     if (last / 2 > 20) file.fMaxRanges = 20; else
                        if (last / 2 > 5) file.fMaxRanges = 5; else file.fMaxRanges = 1;
               last = Math.min(last, file.fMaxRanges * 2);
               // console.log('Change maxranges to ', file.fMaxRanges, 'last', last);
               return send_new_request();
            }

            return rejectFunc(Error("Fail to read with several ranges"));
         }

         // if only single segment requested, return result as is
         if (last - first === 2) {
            let b = new DataView(res);
            if (place.length === 2) return resolveFunc(b);
            blobs.push(b);
            return send_new_request(true);
         }

         // object to access response data
         let hdr = this.getResponseHeader('Content-Type'),
            ismulti = (typeof hdr === 'string') && (hdr.indexOf('multipart') >= 0),
            view = new DataView(res);

         if (!ismulti) {
            // server may returns simple buffer, which combines all segments together

            let hdr_range = this.getResponseHeader('Content-Range'), segm_start = 0, segm_last = -1;

            if (hdr_range && hdr_range.indexOf("bytes") >= 0) {
               let parts = hdr_range.substr(hdr_range.indexOf("bytes") + 6).split(/[\s-\/]+/);
               if (parts.length === 3) {
                  segm_start = parseInt(parts[0]);
                  segm_last = parseInt(parts[1]);
                  if (isNaN(segm_start) || isNaN(segm_last) || (segm_start > segm_last)) {
                     segm_start = 0; segm_last = -1;
                  }
               }
            }

            let canbe_single_segment = (segm_start <= segm_last);
            for (let n = first; n < last; n += 2)
               if ((place[n] < segm_start) || (place[n] + place[n + 1] - 1 > segm_last))
                  canbe_single_segment = false;

            if (canbe_single_segment) {
               for (let n = first; n < last; n += 2)
                  blobs.push(new DataView(res, place[n] - segm_start, place[n + 1]));
               return send_new_request(true);
            }

            if ((file.fMaxRanges === 1) || (first !== 0))
               return rejectFunc(Error('Server returns normal response when multipart was requested, disable multirange support'));

            file.fMaxRanges = 1;
            last = Math.min(last, file.fMaxRanges * 2);

            return send_new_request();
         }

         // multipart messages requires special handling

         let indx = hdr.indexOf("boundary="), boundary = "", n = first, o = 0;
         if (indx > 0) {
            boundary = hdr.substr(indx + 9);
            if ((boundary[0] == '"') && (boundary[boundary.length - 1] == '"'))
               boundary = boundary.substr(1, boundary.length - 2);
            boundary = "--" + boundary;
         } else console.error('Did not found boundary id in the response header');

         while (n < last) {

            let code1, code2 = view.getUint8(o), nline = 0, line = "",
               finish_header = false, segm_start = 0, segm_last = -1;

            while ((o < view.byteLength - 1) && !finish_header && (nline < 5)) {
               code1 = code2;
               code2 = view.getUint8(o + 1);

               if ((code1 == 13) && (code2 == 10)) {
                  if ((line.length > 2) && (line.substr(0, 2) == '--') && (line !== boundary))
                     return rejectFunc(Error('Decode multipart message, expect boundary' + boundary + ' got ' + line));

                  line = line.toLowerCase();

                  if ((line.indexOf("content-range") >= 0) && (line.indexOf("bytes") > 0)) {
                     let parts = line.substr(line.indexOf("bytes") + 6).split(/[\s-\/]+/);
                     if (parts.length === 3) {
                        segm_start = parseInt(parts[0]);
                        segm_last = parseInt(parts[1]);
                        if (isNaN(segm_start) || isNaN(segm_last) || (segm_start > segm_last)) {
                           segm_start = 0; segm_last = -1;
                        }
                     } else {
                        console.error('Fail to decode content-range', line, parts);
                     }
                  }

                  if ((nline > 1) && (line.length === 0)) finish_header = true;

                  o++; nline++; line = "";
                  code2 = view.getUint8(o + 1);
               } else {
                  line += String.fromCharCode(code1);
               }
               o++;
            }

            if (!finish_header)
               return rejectFunc(Error('Cannot decode header in multipart message'));

            if (segm_start > segm_last) {
               // fall-back solution, believe that segments same as requested
               blobs.push(new DataView(res, o, place[n + 1]));
               o += place[n + 1];
               n += 2;
            } else {
               while ((n < last) && (place[n] >= segm_start) && (place[n] + place[n + 1] - 1 <= segm_last)) {
                  blobs.push(new DataView(res, o + place[n] - segm_start, place[n + 1]));
                  n += 2;
               }

               o += (segm_last - segm_start + 1);
            }
         }

         send_new_request(true);
      }

      send_new_request(true);

      return promise;
   }

   /** @summary Get directory with given name and cycle
    * @desc Function only can be used for already read directories, which are preserved in the memory
    * @private */
   TFile.prototype.GetDir = function(dirname, cycle) {

      if ((cycle === undefined) && (typeof dirname == 'string')) {
         const pos = dirname.lastIndexOf(';');
         if (pos > 0) { cycle = parseInt(dirname.substr(pos + 1)); dirname = dirname.substr(0, pos); }
      }

      for (let j = 0; j < this.fDirectories.length; ++j) {
         let dir = this.fDirectories[j];
         if (dir.dir_name != dirname) continue;
         if ((cycle !== undefined) && (dir.dir_cycle !== cycle)) continue;
         return dir;
      }
      return null;
   }

   /** @summary Retrieve a key by its name and cycle in the list of keys
    * @desc callback used when keys must be read first from the directory
    * @private */
   TFile.prototype.GetKey = function(keyname, cycle, only_direct) {

      if (typeof cycle != 'number') cycle = -1;
      let bestkey = null;
      for (let i = 0; i < this.fKeys.length; ++i) {
         let key = this.fKeys[i];
         if (!key || (key.fName !== keyname)) continue;
         if (key.fCycle == cycle) { bestkey = key; break; }
         if ((cycle < 0) && (!bestkey || (key.fCycle > bestkey.fCycle))) bestkey = key;
      }
      if (bestkey)
         return only_direct ? bestkey : Promise.resolve(bestkey);

      let pos = keyname.lastIndexOf("/");
      // try to handle situation when object name contains slashes (bad practice anyway)
      while (pos > 0) {
         let dirname = keyname.substr(0, pos),
            subname = keyname.substr(pos + 1),
            dir = this.GetDir(dirname);

         if (dir) return dir.GetKey(subname, cycle, only_direct);

         let dirkey = this.GetKey(dirname, undefined, true);
         if (dirkey && !only_direct && (dirkey.fClassName.indexOf("TDirectory") == 0))
            return this.ReadObject(dirname).then(newdir => newdir.GetKey(subname, cycle));

         pos = keyname.lastIndexOf("/", pos - 1);
      }

      return only_direct ? null : Promise.reject(Error("Key not found " + keyname));
   }

   /** @summary Read and inflate object buffer described by its key
    * @private */
   TFile.prototype.ReadObjBuffer = function(key) {

      return this.ReadBuffer([key.fSeekKey + key.fKeylen, key.fNbytes - key.fKeylen]).then(blob1 => {

         let buf;

         if (key.fObjlen <= key.fNbytes - key.fKeylen) {
            buf = new TBuffer(blob1, 0, this);
         } else {
            let objbuf = JSROOT.R__unzip(blob1, key.fObjlen);
            if (!objbuf) return Promise.reject(Error("Fail to UNZIP buffer"));
            buf = new TBuffer(objbuf, 0, this);
         }

         buf.fTagOffset = key.fKeylen;

         return buf;
      });
   }

   /** @summary Method called when TTree object is streamed
    * @private */
   TFile.prototype.AddReadTree = function(obj) {

      if (JSROOT.TTreeMethods)
         return JSROOT.extend(obj, JSROOT.TTreeMethods);

      if (this.readTrees === undefined) this.readTrees = [];

      if (this.readTrees.indexOf(obj) < 0) this.readTrees.push(obj);
   }

   /** @summary Read any object from a root file
    * @desc One could specify cycle number in the object name or as separate argument
    * @param {string} obj_name - name of object, may include cycle number like "hpxpy;1"
    * @param {number} [cycle=undefined] - cycle number, also can be included in obj_name
    * @returns {Promise} promise with object read
    * @example
    *   JSROOT.openFile("https://root.cern/js/files/hsimple.root")
    *         .then(f => f.ReadObject("hpxpy;1"))
    *         .then(obj => console.log(`Read object of type ${obj._typename}`))
    * });
    */
   TFile.prototype.ReadObject = function(obj_name, cycle, only_dir) {

      let pos = obj_name.lastIndexOf(";");
      if (pos > 0) {
         cycle = parseInt(obj_name.slice(pos + 1));
         obj_name = obj_name.slice(0, pos);
      }

      if (typeof cycle != 'number') cycle = -1;
      // remove leading slashes
      while (obj_name.length && (obj_name[0] == "/")) obj_name = obj_name.substr(1);

      let file = this, isdir, read_key;

      // one uses Promises while in some cases we need to
      // read sub-directory to get list of keys
      // in such situation calls are asynchrone
      return this.GetKey(obj_name, cycle).then(key => {

         if ((obj_name == "StreamerInfo") && (key.fClassName == "TList"))
            return file.fStreamerInfos;

         if ((key.fClassName == 'TDirectory' || key.fClassName == 'TDirectoryFile')) {
            isdir = true;
            let dir = file.GetDir(obj_name, cycle);
            if (dir) return dir;
         }

         if (!isdir && only_dir)
            return Promise.reject(Error("Key ${obj_name} is not directory}"));

         read_key = key;

         return file.ReadObjBuffer(key);
      }).then(buf => {
         if (isdir) {
            let dir = new TDirectory(file, obj_name, cycle);
            dir.fTitle = read_key.fTitle;
            return dir.ReadKeys(buf);
         }

         let obj = {};
         buf.MapObject(1, obj); // tag object itself with id==1
         buf.ClassStreamer(obj, read_key.fClassName);

         if ((read_key.fClassName === 'TF1') || (read_key.fClassName === 'TF2'))
            return file.ReadFormulas(obj);

         if (!file.readTrees) return obj;

         return JSROOT.require('tree').then(() => {
            if (file.readTrees) {
               file.readTrees.forEach(t => JSROOT.extend(t, JSROOT.TTreeMethods))
               delete file.readTrees;
            }
            return obj;
         });
      });
   }

   /** @summary read formulas from the file and add them to TF1/TF2 objects
    * @private */
   TFile.prototype.ReadFormulas = function(tf1) {

      let arr = [];

      for (let indx = 0; indx < this.fKeys.length; ++indx)
         if (this.fKeys[indx].fClassName == 'TFormula')
            arr.push(this.ReadObject(this.fKeys[indx].fName, this.fKeys[indx].fCycle));

      return Promise.all(arr).then(formulas => {
         formulas.forEach(obj => tf1.addFormula(obj));
         return tf1;
      });
   }

   /** @summary extract streamer infos
    * @private */
   TFile.prototype.ExtractStreamerInfos = function(buf) {
      if (!buf) return;

      let lst = {};
      buf.MapObject(1, lst);
      buf.ClassStreamer(lst, 'TList');

      lst._typename = "TStreamerInfoList";

      this.fStreamerInfos = lst;

      if (typeof JSROOT.addStreamerInfos === 'function')
         JSROOT.addStreamerInfos(lst);

      for (let k = 0; k < lst.arr.length; ++k) {
         let si = lst.arr[k];
         if (!si.fElements) continue;
         for (let l = 0; l < si.fElements.arr.length; ++l) {
            let elem = si.fElements.arr[l];

            if (!elem.fTypeName || !elem.fType) continue;

            let typ = elem.fType, typname = elem.fTypeName;

            if (typ >= 60) {
               if ((typ === jsrio.kStreamer) && (elem._typename == "TStreamerSTL") && elem.fSTLtype && elem.fCtype && (elem.fCtype < 20)) {
                  let prefix = (jsrio.StlNames[elem.fSTLtype] || "undef") + "<";
                  if ((typname.indexOf(prefix) === 0) && (typname[typname.length - 1] == ">")) {
                     typ = elem.fCtype;
                     typname = typname.substr(prefix.length, typname.length - prefix.length - 1).trim();

                     if ((elem.fSTLtype === jsrio.kSTLmap) || (elem.fSTLtype === jsrio.kSTLmultimap))
                        if (typname.indexOf(",") > 0) typname = typname.substr(0, typname.indexOf(",")).trim();
                        else continue;
                  }
               }
               if (typ >= 60) continue;
            } else {
               if ((typ > 20) && (typname[typname.length - 1] == "*")) typname = typname.substr(0, typname.length - 1);
               typ = typ % 20;
            }

            const kind = jsrio.GetTypeId(typname);
            if (kind === typ) continue;

            if ((typ === jsrio.kBits) && (kind === jsrio.kUInt)) continue;
            if ((typ === jsrio.kCounter) && (kind === jsrio.kInt)) continue;

            if (typname && typ && (this.fBasicTypes[typname] !== typ)) {
               this.fBasicTypes[typname] = typ;
               if (!JSROOT.BatchMode) console.log('Extract basic data type', typ, typname);
            }
         }
      }
   }

   /** @summary Read file keys
    * @private */
   TFile.prototype.ReadKeys = function() {

      let file = this;

      // with the first readbuffer we read bigger amount to create header cache
      return this.ReadBuffer([0, 1024]).then(blob => {
         let buf = new TBuffer(blob, 0, file);

         if (buf.substring(0, 4) !== 'root')
            return Promise.reject(Error("NOT A ROOT FILE! " + file.fURL));

         buf.shift(4);

         file.fVersion = buf.ntou4();
         file.fBEGIN = buf.ntou4();
         if (file.fVersion < 1000000) { //small file
            file.fEND = buf.ntou4();
            file.fSeekFree = buf.ntou4();
            file.fNbytesFree = buf.ntou4();
            buf.shift(4); // const nfree = buf.ntoi4();
            file.fNbytesName = buf.ntou4();
            file.fUnits = buf.ntou1();
            file.fCompress = buf.ntou4();
            file.fSeekInfo = buf.ntou4();
            file.fNbytesInfo = buf.ntou4();
         } else { // new format to support large files
            file.fEND = buf.ntou8();
            file.fSeekFree = buf.ntou8();
            file.fNbytesFree = buf.ntou4();
            buf.shift(4); // const nfree = buf.ntou4();
            file.fNbytesName = buf.ntou4();
            file.fUnits = buf.ntou1();
            file.fCompress = buf.ntou4();
            file.fSeekInfo = buf.ntou8();
            file.fNbytesInfo = buf.ntou4();
         }

         // empty file
         if (!file.fSeekInfo || !file.fNbytesInfo)
            return Promise.reject(Error("Empty file " + file.fURL));

         // extra check to prevent reading of corrupted data
         if (!file.fNbytesName || file.fNbytesName > 100000)
            return Promise.reject(Error("Init : cannot read directory info of file " + file.fURL));

         //*-*-------------Read directory info
         let nbytes = file.fNbytesName + 22;
         nbytes += 4;  // fDatimeC.Sizeof();
         nbytes += 4;  // fDatimeM.Sizeof();
         nbytes += 18; // fUUID.Sizeof();
         // assume that the file may be above 2 Gbytes if file version is > 4
         if (file.fVersion >= 40000) nbytes += 12;

         // this part typically read from the header, no need to optimize
         return file.ReadBuffer([file.fBEGIN, Math.max(300, nbytes)]);
      }).then(blob3 => {

         let buf3 = new TBuffer(blob3, 0, file);

         // keep only title from TKey data
         file.fTitle = buf3.ReadTKey().fTitle;

         buf3.locate(file.fNbytesName);

         // we read TDirectory part of TFile
         buf3.ClassStreamer(file, 'TDirectory');

         if (!file.fSeekKeys)
            return Promise.reject(Error("Empty keys list in " + file.fURL));

         // read with same request keys and streamer infos
         return file.ReadBuffer([file.fSeekKeys, file.fNbytesKeys, file.fSeekInfo, file.fNbytesInfo]);
      }).then(blobs => {

         let buf4 = new TBuffer(blobs[0], 0, file);

         buf4.ReadTKey(); //
         const nkeys = buf4.ntoi4();
         for (let i = 0; i < nkeys; ++i)
            file.fKeys.push(buf4.ReadTKey());

         let buf5 = new TBuffer(blobs[1], 0, file),
            si_key = buf5.ReadTKey();
         if (!si_key)
            return Promise.reject(Error("Fail to read data for TKeys"));

         file.fKeys.push(si_key);
         return file.ReadObjBuffer(si_key);
      }).then(blob6 => {
          file.ExtractStreamerInfos(blob6);
          return file;
      });
   }

   /** @summary Read the directory content from  a root file
    * @desc If directory was already read - return previously read object
    * Same functionality as {@link ReadObject}
    * @param {string} dir_name - directory name
    * @param {number} [cycle=undefined] - directory cycle
    * @retunrs {Promise} - read directory */
   TFile.prototype.ReadDirectory = function(dir_name, cycle) {
      return this.ReadObject(dir_name, cycle, true);
   }

   /** @summary Search for class streamer info
    * @private */
   TFile.prototype.FindStreamerInfo = function(clname, clversion, clchecksum) {
      if (this.fStreamerInfos)
         for (let i = 0; i < this.fStreamerInfos.arr.length; ++i) {
            let si = this.fStreamerInfos.arr[i];

            // checksum is enough to identify class
            if ((clchecksum !== undefined) && (si.fCheckSum === clchecksum)) return si;

            if (si.fName !== clname) continue;

            // checksum should match
            if (clchecksum !== undefined) continue;

            if ((clversion !== undefined) && (si.fClassVersion !== clversion)) continue;

            return si;
         }

      return null;
   }

   TFile.prototype.FindSinfoCheckum = function(checksum) {
      if (!this.fStreamerInfos) return null;

      let cache = this.fStreamerInfos.cache,
         arr = this.fStreamerInfos.arr;
      if (!cache) cache = this.fStreamerInfos.cache = {};

      let si = cache[checksum];
      if (si !== undefined) return si;

      for (let i = 0; i < arr.length; ++i) {
         si = arr[i];
         if (si.fCheckSum === checksum) {
            cache[checksum] = si;
            return si;
         }
      }

      cache[checksum] = null; // checksum didnot found, not try again
      return null;
   }

   /** @summary Returns streamer for the class 'clname',
    * @desc From the list of streamers or generate it from the streamer infos and add it to the list
    * @private */
   TFile.prototype.GetStreamer = function(clname, ver, s_i) {

      // these are special cases, which are handled separately
      if (clname == 'TQObject' || clname == "TBasket") return null;

      let streamer, fullname = clname;

      if (ver) {
         fullname += (ver.checksum ? ("$chksum" + ver.checksum) : ("$ver" + ver.val));
         streamer = this.fStreamers[fullname];
         if (streamer !== undefined) return streamer;
      }

      let custom = jsrio.CustomStreamers[clname];

      // one can define in the user streamers just aliases
      if (typeof custom === 'string')
         return this.GetStreamer(custom, ver, s_i);

      // streamer is just separate function
      if (typeof custom === 'function') {
         streamer = [{ typename: clname, func: custom }];
         return jsrio.AddClassMethods(clname, streamer);
      }

      streamer = [];

      if (typeof custom === 'object') {
         if (!custom.name && !custom.func) return custom;
         streamer.push(custom); // special read entry, add in the beginning of streamer
      }

      // check element in streamer infos, one can have special cases
      if (!s_i) s_i = this.FindStreamerInfo(clname, ver.val, ver.checksum);

      if (!s_i) {
         delete this.fStreamers[fullname];
         if (!ver.nowarning)
            console.warn("Not found streamer for", clname, "ver", ver.val, "checksum", ver.checksum, fullname);
         return null;
      }

      // for each entry in streamer info produce member function

      if (s_i.fElements)
         for (let j = 0; j < s_i.fElements.arr.length; ++j)
            streamer.push(jsrio.CreateMember(s_i.fElements.arr[j], this));

      this.fStreamers[fullname] = streamer;

      return jsrio.AddClassMethods(clname, streamer);
   }

   /** @summary Here we produce list of members, resolving all base classes
    * @private */
   TFile.prototype.GetSplittedStreamer = function(streamer, tgt) {
      if (!streamer) return tgt;

      if (!tgt) tgt = [];

      for (let n = 0; n < streamer.length; ++n) {
         let elem = streamer[n];

         if (elem.base === undefined) {
            tgt.push(elem);
            continue;
         }

         if (elem.basename == 'TObject') {
            tgt.push({
               func: function(buf, obj) {
                  buf.ntoi2(); // read version, why it here??
                  obj.fUniqueID = buf.ntou4();
                  obj.fBits = buf.ntou4();
                  if (obj.fBits & jsrio.kIsReferenced) buf.ntou2(); // skip pid
               }
            });
            continue;
         }

         let ver = { val: elem.base };

         if (ver.val === 4294967295) {
            // this is -1 and indicates foreign class, need more workarounds
            ver.val = 1; // need to search version 1 - that happens when several versions of foreign class exists ???
         }

         let parent = this.GetStreamer(elem.basename, ver);
         if (parent) this.GetSplittedStreamer(parent, tgt);
      }

      return tgt;
   }

   TFile.prototype.Delete = function() {
      this.fDirectories = null;
      this.fKeys = null;
      this.fStreamers = null;
      this.fSeekInfo = 0;
      this.fNbytesInfo = 0;
      this.fTagOffset = 0;
   }

   // =======================================================================

   /** @summary Reconstruct ROOT object from binary buffer
     * @desc Method can be used to reconstruct ROOT objects from binary buffer
     * which can be requested from running THttpServer, using **root.bin** request
     * To decode data, one has to request streamer infos data __after__ object data
     * as it shown in example.
     *
     * Method provided for convenience only to see how binary IO works.
     * It is strongly recommended to use **root.json** request to get data directly in
     * JSON format
     *
     * @param {string} class_name - Class name of the object
     * @param {binary} obj_rawdata - data of object root.bin request
     * @param {binary} sinfo_rawdata - data of streamer info root.bin request
     * @returns {object} - created JavaScript object
     * @example
     * JSROOT.httpRequest("http://localhost:8080/Files/job1.root/hpx/root.bin", "buf")
     *       .then(obj_data => JSROOT.httpRequest("http://localhost:8080/StreamerInfo/root.bin", "buf"))
     *       .then(si_data => JSROOT.ReconstructObject("TH1F", obj_data, si_data))
     *       .then(histo => console.log(`Get histogram with title = ${histo.fTitle}`))
     *       .catch(err => console.error(err.message));
     *
     * // same data via root.json request
     * JSROOT.httpRequest("http://localhost:8080/Files/job1.root/hpx/root.json", "object")
     *       .then(histo => console.log(`Get histogram with title = ${histo.fTitle}`))
     *       .catch(err => console.error(err.message));
     */

   JSROOT.ReconstructObject = function(class_name, obj_rawdata, sinfo_rawdata) {

      let file = new TFile;
      let buf = new TBuffer(sinfo_rawdata, 0, file);
      file.ExtractStreamerInfos(buf);

      let obj = {};

      buf = new TBuffer(obj_rawdata, 0, file);
      buf.MapObject(obj, 1);
      buf.ClassStreamer(obj, class_name);

      return obj;
   }


   jsrio.GetPairStreamer = function(si, typname, file) {
      if (!si) {
         if (typname.indexOf("pair") !== 0) return null;

         si = file.FindStreamerInfo(typname);

         if (!si) {
            let p1 = typname.indexOf("<"), p2 = typname.lastIndexOf(">");
            function GetNextName() {
               let res = "", p = p1 + 1, cnt = 0;
               while ((p < p2) && (cnt >= 0)) {
                  switch (typname[p]) {
                     case "<": cnt++; break;
                     case ",": if (cnt === 0) cnt--; break;
                     case ">": cnt--; break;
                  }
                  if (cnt >= 0) res += typname[p];
                  p++;
               }
               p1 = p - 1;
               return res.trim();
            }
            si = { _typename: 'TStreamerInfo', fVersion: 1, fName: typname, fElements: JSROOT.Create("TList") };
            si.fElements.Add(jsrio.CreateStreamerElement("first", GetNextName(), file));
            si.fElements.Add(jsrio.CreateStreamerElement("second", GetNextName(), file));
         }
      }

      let streamer = file.GetStreamer(typname, null, si);

      if (!streamer) return null;

      if (streamer.length !== 2) {
         console.error('Streamer for pair class contains ', streamer.length, 'elements');
         return null;
      }

      for (let nn = 0; nn < 2; ++nn)
         if (streamer[nn].readelem && !streamer[nn].pair_name) {
            streamer[nn].pair_name = (nn == 0) ? "first" : "second";
            streamer[nn].func = function(buf, obj) {
               obj[this.pair_name] = this.readelem(buf);
            }
         }

      return streamer;
   }

   jsrio.CreateMember = function(element, file) {
      // create member entry for streamer element, which is used for reading of such data

      let member = {
         name: element.fName, type: element.fType,
         fArrayLength: element.fArrayLength,
         fArrayDim: element.fArrayDim,
         fMaxIndex: element.fMaxIndex
      };

      if (element.fTypeName === 'BASE') {
         if (jsrio.GetArrayKind(member.name) > 0) {
            // this is workaround for arrays as base class
            // we create 'fArray' member, which read as any other data member
            member.name = 'fArray';
            member.type = jsrio.kAny;
         } else {
            // create streamer for base class
            member.type = jsrio.kBase;
            // this.GetStreamer(element.fName);
         }
      }

      switch (member.type) {
         case jsrio.kBase:
            member.base = element.fBaseVersion; // indicate base class
            member.basename = element.fName; // keep class name
            member.func = function(buf, obj) { buf.ClassStreamer(obj, this.basename); };
            break;
         case jsrio.kShort:
            member.func = function(buf, obj) { obj[this.name] = buf.ntoi2(); }; break;
         case jsrio.kInt:
         case jsrio.kCounter:
            member.func = function(buf, obj) { obj[this.name] = buf.ntoi4(); }; break;
         case jsrio.kLong:
         case jsrio.kLong64:
            member.func = function(buf, obj) { obj[this.name] = buf.ntoi8(); }; break;
         case jsrio.kDouble:
            member.func = function(buf, obj) { obj[this.name] = buf.ntod(); }; break;
         case jsrio.kFloat:
            member.func = function(buf, obj) { obj[this.name] = buf.ntof(); }; break;
         case jsrio.kLegacyChar:
         case jsrio.kUChar:
            member.func = function(buf, obj) { obj[this.name] = buf.ntou1(); }; break;
         case jsrio.kUShort:
            member.func = function(buf, obj) { obj[this.name] = buf.ntou2(); }; break;
         case jsrio.kBits:
         case jsrio.kUInt:
            member.func = function(buf, obj) { obj[this.name] = buf.ntou4(); }; break;
         case jsrio.kULong64:
         case jsrio.kULong:
            member.func = function(buf, obj) { obj[this.name] = buf.ntou8(); }; break;
         case jsrio.kBool:
            member.func = function(buf, obj) { obj[this.name] = buf.ntou1() != 0; }; break;
         case jsrio.kOffsetL + jsrio.kBool:
         case jsrio.kOffsetL + jsrio.kInt:
         case jsrio.kOffsetL + jsrio.kCounter:
         case jsrio.kOffsetL + jsrio.kDouble:
         case jsrio.kOffsetL + jsrio.kUChar:
         case jsrio.kOffsetL + jsrio.kShort:
         case jsrio.kOffsetL + jsrio.kUShort:
         case jsrio.kOffsetL + jsrio.kBits:
         case jsrio.kOffsetL + jsrio.kUInt:
         case jsrio.kOffsetL + jsrio.kULong:
         case jsrio.kOffsetL + jsrio.kULong64:
         case jsrio.kOffsetL + jsrio.kLong:
         case jsrio.kOffsetL + jsrio.kLong64:
         case jsrio.kOffsetL + jsrio.kFloat:
            if (element.fArrayDim < 2) {
               member.arrlength = element.fArrayLength;
               member.func = function(buf, obj) {
                  obj[this.name] = buf.ReadFastArray(this.arrlength, this.type - jsrio.kOffsetL);
               };
            } else {
               member.arrlength = element.fMaxIndex[element.fArrayDim - 1];
               member.minus1 = true;
               member.func = function(buf, obj) {
                  obj[this.name] = buf.ReadNdimArray(this, (buf, handle) =>
                     buf.ReadFastArray(handle.arrlength, handle.type - jsrio.kOffsetL));
               };
            }
            break;
         case jsrio.kOffsetL + jsrio.kChar:
            if (element.fArrayDim < 2) {
               member.arrlength = element.fArrayLength;
               member.func = function(buf, obj) {
                  obj[this.name] = buf.ReadFastString(this.arrlength);
               };
            } else {
               member.minus1 = true; // one dimension used for char*
               member.arrlength = element.fMaxIndex[element.fArrayDim - 1];
               member.func = function(buf, obj) {
                  obj[this.name] = buf.ReadNdimArray(this, (buf, handle) =>
                     buf.ReadFastString(handle.arrlength));
               };
            }
            break;
         case jsrio.kOffsetP + jsrio.kBool:
         case jsrio.kOffsetP + jsrio.kInt:
         case jsrio.kOffsetP + jsrio.kDouble:
         case jsrio.kOffsetP + jsrio.kUChar:
         case jsrio.kOffsetP + jsrio.kShort:
         case jsrio.kOffsetP + jsrio.kUShort:
         case jsrio.kOffsetP + jsrio.kBits:
         case jsrio.kOffsetP + jsrio.kUInt:
         case jsrio.kOffsetP + jsrio.kULong:
         case jsrio.kOffsetP + jsrio.kULong64:
         case jsrio.kOffsetP + jsrio.kLong:
         case jsrio.kOffsetP + jsrio.kLong64:
         case jsrio.kOffsetP + jsrio.kFloat:
            member.cntname = element.fCountName;
            member.func = function(buf, obj) {
               if (buf.ntou1() === 1)
                  obj[this.name] = buf.ReadFastArray(obj[this.cntname], this.type - jsrio.kOffsetP);
               else
                  obj[this.name] = new Array();
            };
            break;
         case jsrio.kOffsetP + jsrio.kChar:
            member.cntname = element.fCountName;
            member.func = function(buf, obj) {
               if (buf.ntou1() === 1)
                  obj[this.name] = buf.ReadFastString(obj[this.cntname]);
               else
                  obj[this.name] = null;
            };
            break;
         case jsrio.kDouble32:
         case jsrio.kOffsetL + jsrio.kDouble32:
         case jsrio.kOffsetP + jsrio.kDouble32:
            member.double32 = true;
         case jsrio.kFloat16:
         case jsrio.kOffsetL + jsrio.kFloat16:
         case jsrio.kOffsetP + jsrio.kFloat16:
            if (element.fFactor !== 0) {
               member.factor = 1. / element.fFactor;
               member.min = element.fXmin;
               member.read = function(buf) { return buf.ntou4() * this.factor + this.min; };
            } else
               if ((element.fXmin === 0) && member.double32) {
                  member.read = function(buf) { return buf.ntof(); };
               } else {
                  member.nbits = Math.round(element.fXmin);
                  if (member.nbits === 0) member.nbits = 12;
                  member.dv = new DataView(new ArrayBuffer(8), 0); // used to cast from uint32 to float32
                  member.read = function(buf) {
                     let theExp = buf.ntou1(), theMan = buf.ntou2();
                     this.dv.setUint32(0, (theExp << 23) | ((theMan & ((1 << (this.nbits + 1)) - 1)) << (23 - this.nbits)));
                     return ((1 << (this.nbits + 1) & theMan) ? -1 : 1) * this.dv.getFloat32(0);
                  };
               }

            member.readarr = function(buf, len) {
               let arr = this.double32 ? new Float64Array(len) : new Float32Array(len);
               for (let n = 0; n < len; ++n) arr[n] = this.read(buf);
               return arr;
            }

            if (member.type < jsrio.kOffsetL) {
               member.func = function(buf, obj) { obj[this.name] = this.read(buf); }
            } else
               if (member.type > jsrio.kOffsetP) {
                  member.cntname = element.fCountName;
                  member.func = function(buf, obj) {
                     if (buf.ntou1() === 1) {
                        obj[this.name] = this.readarr(buf, obj[this.cntname]);
                     } else {
                        obj[this.name] = null;
                     }
                  };
               } else
                  if (element.fArrayDim < 2) {
                     member.arrlength = element.fArrayLength;
                     member.func = function(buf, obj) { obj[this.name] = this.readarr(buf, this.arrlength); };
                  } else {
                     member.arrlength = element.fMaxIndex[element.fArrayDim - 1];
                     member.minus1 = true;
                     member.func = function(buf, obj) {
                        obj[this.name] = buf.ReadNdimArray(this, (buf, handle) => handle.readarr(buf, handle.arrlength));
                     };
                  }
            break;

         case jsrio.kAnyP:
         case jsrio.kObjectP:
            member.func = function(buf, obj) {
               obj[this.name] = buf.ReadNdimArray(this, buf => buf.ReadObjectAny());
            };
            break;

         case jsrio.kAny:
         case jsrio.kAnyp:
         case jsrio.kObjectp:
         case jsrio.kObject: {
            let classname = (element.fTypeName === 'BASE') ? element.fName : element.fTypeName;
            if (classname[classname.length - 1] == "*")
               classname = classname.substr(0, classname.length - 1);

            const arrkind = jsrio.GetArrayKind(classname);

            if (arrkind > 0) {
               member.arrkind = arrkind;
               member.func = function(buf, obj) { obj[this.name] = buf.ReadFastArray(buf.ntou4(), this.arrkind); };
            } else if (arrkind === 0) {
               member.func = function(buf, obj) { obj[this.name] = buf.ReadTString(); };
            } else {
               member.classname = classname;

               if (element.fArrayLength > 1) {
                  member.func = function(buf, obj) {
                     obj[this.name] = buf.ReadNdimArray(this, (buf, handle) => buf.ClassStreamer({}, handle.classname));
                  };
               } else {
                  member.func = function(buf, obj) {
                     obj[this.name] = buf.ClassStreamer({}, this.classname);
                  };
               }
            }
            break;
         }
         case jsrio.kOffsetL + jsrio.kObject:
         case jsrio.kOffsetL + jsrio.kAny:
         case jsrio.kOffsetL + jsrio.kAnyp:
         case jsrio.kOffsetL + jsrio.kObjectp: {
            let classname = element.fTypeName;
            if (classname[classname.length - 1] == "*")
               classname = classname.substr(0, classname.length - 1);

            member.arrkind = jsrio.GetArrayKind(classname);
            if (member.arrkind < 0) member.classname = classname;
            member.func = function(buf, obj) {
               obj[this.name] = buf.ReadNdimArray(this, (buf, handle) => {
                  if (handle.arrkind > 0) return buf.ReadFastArray(buf.ntou4(), handle.arrkind);
                  if (handle.arrkind === 0) return buf.ReadTString();
                  return buf.ClassStreamer({}, handle.classname);
               });
            }
            break;
         }
         case jsrio.kChar:
            member.func = function(buf, obj) { obj[this.name] = buf.ntoi1(); }; break;
         case jsrio.kCharStar:
            member.func = function(buf, obj) {
               const len = buf.ntoi4();
               obj[this.name] = buf.substring(buf.o, buf.o + len);
               buf.o += len;
            };
            break;
         case jsrio.kTString:
            member.func = function(buf, obj) { obj[this.name] = buf.ReadTString(); };
            break;
         case jsrio.kTObject:
         case jsrio.kTNamed:
            member.typename = element.fTypeName;
            member.func = function(buf, obj) { obj[this.name] = buf.ClassStreamer({}, this.typename); };
            break;
         case jsrio.kOffsetL + jsrio.kTString:
         case jsrio.kOffsetL + jsrio.kTObject:
         case jsrio.kOffsetL + jsrio.kTNamed:
            member.typename = element.fTypeName;
            member.func = function(buf, obj) {
               const ver = buf.ReadVersion();
               obj[this.name] = buf.ReadNdimArray(this, (buf, handle) => {
                  if (handle.typename === 'TString') return buf.ReadTString();
                  return buf.ClassStreamer({}, handle.typename);
               });
               buf.CheckBytecount(ver, this.typename + "[]");
            };
            break;
         case jsrio.kStreamLoop:
         case jsrio.kOffsetL + jsrio.kStreamLoop:
            member.typename = element.fTypeName;
            member.cntname = element.fCountName;

            if (member.typename.lastIndexOf("**") > 0) {
               member.typename = member.typename.substr(0, member.typename.lastIndexOf("**"));
               member.isptrptr = true;
            } else {
               member.typename = member.typename.substr(0, member.typename.lastIndexOf("*"));
               member.isptrptr = false;
            }

            if (member.isptrptr) {
               member.readitem = function(buf) { return buf.ReadObjectAny(); }
            } else {
               member.arrkind = jsrio.GetArrayKind(member.typename);
               if (member.arrkind > 0)
                  member.readitem = function(buf) { return buf.ReadFastArray(buf.ntou4(), this.arrkind); }
               else if (member.arrkind === 0)
                  member.readitem = function(buf) { return buf.ReadTString(); }
               else
                  member.readitem = function(buf) { return buf.ClassStreamer({}, this.typename); }
            }

            if (member.readitem !== undefined) {
               member.read_loop = function(buf, cnt) {
                  return buf.ReadNdimArray(this, (buf2, member2) => {
                     let itemarr = new Array(cnt);
                     for (let i = 0; i < cnt; ++i)
                        itemarr[i] = member2.readitem(buf2);
                     return itemarr;
                  });
               }

               member.func = function(buf, obj) {
                  const ver = buf.ReadVersion();
                  let res = this.read_loop(buf, obj[this.cntname]);
                  if (!buf.CheckBytecount(ver, this.typename)) res = null;
                  obj[this.name] = res;
               }
               member.branch_func = function(buf, obj) {
                  // this is special functions, used by branch in the STL container

                  const ver = buf.ReadVersion(), sz0 = obj[this.stl_size];
                  let res = new Array(sz0);

                  for (let loop0 = 0; loop0 < sz0; ++loop0) {
                     let cnt = obj[this.cntname][loop0];
                     res[loop0] = this.read_loop(buf, cnt);
                  }
                  if (!buf.CheckBytecount(ver, this.typename)) res = null;
                  obj[this.name] = res;
               }

               member.objs_branch_func = function(buf, obj) {
                  // special function when branch read as part of complete object
                  // objects already preallocated and only appropriate member must be set
                  // see code in JSRoot.tree.js for reference

                  const ver = buf.ReadVersion();
                  let arr = obj[this.name0]; // objects array where reading is done

                  for (let loop0 = 0; loop0 < arr.length; ++loop0) {
                     let obj1 = this.get(arr, loop0), cnt = obj1[this.cntname];
                     obj1[this.name] = this.read_loop(buf, cnt);
                  }

                  buf.CheckBytecount(ver, this.typename);
               }

            } else {
               console.error(`fail to provide function for ${element.fName} (${element.fTypeName})  typ = ${element.fType}`);
               member.func = function(buf, obj) {
                  const ver = buf.ReadVersion();
                  buf.CheckBytecount(ver);
                  obj[this.name] = ull;
               };
            }

            break;

         case jsrio.kStreamer: {
            member.typename = element.fTypeName;

            let stl = (element.fSTLtype || 0) % 40;

            if ((element._typename === 'TStreamerSTLstring') ||
               (member.typename == "string") || (member.typename == "string*")) {
               member.readelem = function(buf) { return buf.ReadTString(); };
            } else
               if ((stl === jsrio.kSTLvector) || (stl === jsrio.kSTLlist) ||
                  (stl === jsrio.kSTLdeque) || (stl === jsrio.kSTLset) ||
                  (stl === jsrio.kSTLmultiset)) {
                  let p1 = member.typename.indexOf("<"),
                     p2 = member.typename.lastIndexOf(">");

                  member.conttype = member.typename.substr(p1 + 1, p2 - p1 - 1).trim();

                  member.typeid = jsrio.GetTypeId(member.conttype);
                  if ((member.typeid < 0) && file.fBasicTypes[member.conttype]) {
                     member.typeid = file.fBasicTypes[member.conttype];
                     console.log('!!! Reuse basic type', member.conttype, 'from file streamer infos');
                  }

                  // check
                  if (element.fCtype && (element.fCtype < 20) && (element.fCtype !== member.typeid)) {
                     console.warn('Contained type', member.conttype, 'not recognized as basic type', element.fCtype, 'FORCE');
                     member.typeid = element.fCtype;
                  }

                  if (member.typeid > 0) {
                     member.readelem = function(buf) {
                        return buf.ReadFastArray(buf.ntoi4(), this.typeid);
                     };
                  } else {
                     member.isptr = false;

                     if (member.conttype.lastIndexOf("*") === member.conttype.length - 1) {
                        member.isptr = true;
                        member.conttype = member.conttype.substr(0, member.conttype.length - 1);
                     }

                     if (element.fCtype === jsrio.kObjectp) member.isptr = true;

                     member.arrkind = jsrio.GetArrayKind(member.conttype);

                     member.readelem = jsrio.ReadVectorElement;

                     if (!member.isptr && (member.arrkind < 0)) {

                        let subelem = jsrio.CreateStreamerElement("temp", member.conttype);

                        if (subelem.fType === jsrio.kStreamer) {
                           subelem.$fictional = true;
                           member.submember = jsrio.CreateMember(subelem, file);
                        }
                     }
                  }
               } else
                  if ((stl === jsrio.kSTLmap) || (stl === jsrio.kSTLmultimap)) {

                     const p1 = member.typename.indexOf("<"),
                           p2 = member.typename.lastIndexOf(">");

                     member.pairtype = "pair<" + member.typename.substr(p1 + 1, p2 - p1 - 1) + ">";

                     // remember found streamer info from the file -
                     // most probably it is the only one which should be used
                     member.si = file.FindStreamerInfo(member.pairtype);

                     member.streamer = jsrio.GetPairStreamer(member.si, member.pairtype, file);

                     if (!member.streamer || (member.streamer.length !== 2)) {
                        console.error(`Fail to build streamer for pair ${member.pairtype}`);
                        delete member.streamer;
                     }

                     if (member.streamer) member.readelem = jsrio.ReadMapElement;
                  } else
                     if (stl === jsrio.kSTLbitset) {
                        member.readelem = function(buf/*, obj*/) {
                           return buf.ReadFastArray(buf.ntou4(), jsrio.kBool);
                        }
                     }

            if (!member.readelem) {
               console.error(`'failed to create streamer for element ${member.typename} ${member.name} element ${element._typename} STL type ${element.fSTLtype}`);
               member.func = function(buf, obj) {
                  const ver = buf.ReadVersion();
                  buf.CheckBytecount(ver);
                  obj[this.name] = null;
               }
            } else
               if (!element.$fictional) {

                  member.read_version = function(buf, cnt) {
                     if (cnt === 0) return null;
                     const ver = buf.ReadVersion();
                     this.member_wise = ((ver.val & jsrio.kStreamedMemberWise) !== 0);

                     this.stl_version = undefined;
                     if (this.member_wise) {
                        ver.val = ver.val & ~jsrio.kStreamedMemberWise;
                        this.stl_version = { val: buf.ntoi2() };
                        if (this.stl_version.val <= 0) this.stl_version.checksum = buf.ntou4();
                     }
                     return ver;
                  }

                  member.func = function(buf, obj) {
                     const ver = this.read_version(buf);

                     let res = buf.ReadNdimArray(this, (buf2, member2) => member2.readelem(buf2));

                     if (!buf.CheckBytecount(ver, this.typename)) res = null;
                     obj[this.name] = res;
                  }

                  member.branch_func = function(buf, obj) {
                     // special function to read data from STL branch
                     const cnt = obj[this.stl_size],
                           ver = this.read_version(buf, cnt);
                     let arr = new Array(cnt);

                     for (let n = 0; n < cnt; ++n)
                        arr[n] = buf.ReadNdimArray(this, (buf2, member2) => member2.readelem(buf2));

                     if (ver) buf.CheckBytecount(ver, "branch " + this.typename);

                     obj[this.name] = arr;
                  }
                  member.split_func = function(buf, arr, n) {
                     // function to read array from member-wise streaming
                     const ver = this.read_version(buf);
                     for (let i = 0; i < n; ++i)
                        arr[i][this.name] = buf.ReadNdimArray(this, (buf2, member2) => member2.readelem(buf2));
                     buf.CheckBytecount(ver, this.typename);
                  }
                  member.objs_branch_func = function(buf, obj) {
                     // special function when branch read as part of complete object
                     // objects already preallocated and only appropriate member must be set
                     // see code in JSRoot.tree.js for reference

                     let arr = obj[this.name0]; // objects array where reading is done

                     const ver = this.read_version(buf, arr.length);

                     for (let n = 0; n < arr.length; ++n) {
                        let obj1 = this.get(arr, n);
                        obj1[this.name] = buf.ReadNdimArray(this, (buf2, member2) => member2.readelem(buf2));
                     }

                     if (ver) buf.CheckBytecount(ver, "branch " + this.typename);
                  }
               }
            break;
         }

         default:
            console.error(`fail to provide function for ${element.fName} (${element.fTypeName})  typ = ${element.fType}`);

            member.func = function(/*buf, obj*/) { };  // do nothing, fix in the future
      }

      return member;
   }

   // =============================================================

   function TLocalFile(file) {
      TFile.call(this, null);
      this.fUseStampPar = false;
      this.fLocalFile = file;
      this.fEND = file.size;
      this.fFullURL = file.name;
      this.fURL = file.name;
      this.fFileName = file.name;
   }

   TLocalFile.prototype = Object.create(TFile.prototype)

   /** @summary Open file
    * @returns {Promise} after file keys are read
    * @private */
   TLocalFile.prototype.Open = function() { return this.ReadKeys(); }

   TLocalFile.prototype.ReadBuffer = function(place, filename /*, progress_callback */) {
      let file = this.fLocalFile;

      return new Promise((resolve, reject) => {
         if (filename)
            return reject(Error("Cannot access other local file " + filename));

         let reader = new FileReader(), cnt = 0, blobs = [];

         reader.onload = function(evnt) {
            let res = new DataView(evnt.target.result);
            if (place.length === 2) return resolve(res);

            blobs.push(res);
            cnt += 2;
            if (cnt >= place.length) return resolve(blobs);
            reader.readAsArrayBuffer(file.slice(place[cnt], place[cnt] + place[cnt + 1]));
         }

         reader.readAsArrayBuffer(file.slice(place[0], place[0] + place[1]));
      });
   }

   // =============================================================

   function TNodejsFile(filename) {
      TFile.call(this, null);
      this.fUseStampPar = false;
      this.fEND = 0;
      this.fFullURL = filename;
      this.fURL = filename;
      this.fFileName = filename;
   }

   TNodejsFile.prototype = Object.create(TFile.prototype)

   /** @brief Open file
    * @returns {Promise} after file keys are read
    * @private */
   TNodejsFile.prototype.Open = function() {
      this.fs = require('fs');

      return new Promise((resolve,reject) =>

         this.fs.open(filename, 'r', (status, fd) => {
            if (status) {
               console.log(status.message);
               return reject(Error(`Not possible to open ${filename} inside node.js`));
            }
            let stats = this.fs.fstatSync(fd);

            this.fEND = stats.size;

            this.fd = fd;

            this.ReadKeys().then(resolve).catch(reject);
         })
      );
   }

   /** @brief Read buffer from local file
    * @returns {Promise} with required blocks
    * @private */

   TNodejsFile.prototype.ReadBuffer = function(place, filename /*, progress_callback */) {
      return new Promise((resolve, reject) => {
         if (filename)
            return reject(Error(`Cannot access other local file ${filename}`));

         if (!this.fs || !this.fd)
            return reject(Error(`File is not opened ${this.fFileName}`));

         let cnt = 0, blobs = [];

         function readfunc(err, bytesRead, buf) {

            let res = new DataView(buf.buffer, buf.byteOffset, place[cnt + 1]);
            if (place.length === 2) return resolve(res);

            blobs.push(res);
            cnt += 2;
            if (cnt >= place.length) return resolve(blobs);
            this.fs.read(this.fd, new Buffer(place[cnt + 1]), 0, place[cnt + 1], place[cnt], readfunc);
         }

         this.fs.read(this.fd, new Buffer(place[1]), 0, place[1], place[0], readfunc);
      });
   }

   jsrio.ProduceCustomStreamers = function() {
      let cs = jsrio.CustomStreamers;

      cs['TObject'] = cs['TMethodCall'] = function(buf, obj) {
         obj.fUniqueID = buf.ntou4();
         obj.fBits = buf.ntou4();
         if (obj.fBits & jsrio.kIsReferenced) buf.ntou2(); // skip pid
      };

      cs['TNamed'] = [
         {
            basename: 'TObject', base: 1, func: function(buf, obj) {
               if (!obj._typename) obj._typename = 'TNamed';
               buf.ClassStreamer(obj, "TObject");
            }
         },
         { name: 'fName', func: function(buf, obj) { obj.fName = buf.ReadTString(); } },
         { name: 'fTitle', func: function(buf, obj) { obj.fTitle = buf.ReadTString(); } }
      ];
      jsrio.AddClassMethods('TNamed', cs['TNamed']);

      cs['TObjString'] = [
         {
            basename: 'TObject', base: 1, func: function(buf, obj) {
               if (!obj._typename) obj._typename = 'TObjString';
               buf.ClassStreamer(obj, "TObject");
            }
         },
         { name: 'fString', func: function(buf, obj) { obj.fString = buf.ReadTString(); } }
      ];

      jsrio.AddClassMethods('TObjString', cs['TObjString']);

      cs['TList'] = cs['THashList'] = function(buf, obj) {
         // stream all objects in the list from the I/O buffer
         if (!obj._typename) obj._typename = this.typename;
         obj.$kind = "TList"; // all derived classes will be marked as well
         if (buf.last_read_version > 3) {
            buf.ClassStreamer(obj, "TObject");
            obj.name = buf.ReadTString();
            const nobjects = buf.ntou4();
            obj.arr = new Array(nobjects);
            obj.opt = new Array(nobjects);
            for (let i = 0; i < nobjects; ++i) {
               obj.arr[i] = buf.ReadObjectAny();
               obj.opt[i] = buf.ReadTString();
            }
         } else {
            obj.name = "";
            obj.arr = [];
            obj.opt = [];
         }
      };

      cs['TClonesArray'] = function(buf, list) {
         if (!list._typename) list._typename = "TClonesArray";
         list.$kind = "TClonesArray";
         list.name = "";
         const ver = buf.last_read_version;
         if (ver > 2) buf.ClassStreamer(list, "TObject");
         if (ver > 1) list.name = buf.ReadTString();
         let classv = buf.ReadTString(), clv = 0,
            pos = classv.lastIndexOf(";");

         if (pos > 0) {
            clv = parseInt(classv.substr(pos + 1));
            classv = classv.substr(0, pos);
         }

         let nobjects = buf.ntou4();
         if (nobjects < 0) nobjects = -nobjects;  // for backward compatibility

         list.arr = new Array(nobjects);
         list.fLast = nobjects - 1;
         list.fLowerBound = buf.ntou4();

         let streamer = buf.fFile.GetStreamer(classv, { val: clv });
         streamer = buf.fFile.GetSplittedStreamer(streamer);

         if (!streamer) {
            console.log('Cannot get member-wise streamer for', classv, clv);
         } else {
            // create objects
            for (let n = 0; n < nobjects; ++n)
               list.arr[n] = { _typename: classv };

            // call streamer for all objects member-wise
            for (let k = 0; k < streamer.length; ++k)
               for (let n = 0; n < nobjects; ++n)
                  streamer[k].func(buf, list.arr[n]);
         }
      };

      cs['TMap'] = function(buf, map) {
         if (!map._typename) map._typename = "TMap";
         map.name = "";
         map.arr = new Array();
         const ver = buf.last_read_version;
         if (ver > 2) buf.ClassStreamer(map, "TObject");
         if (ver > 1) map.name = buf.ReadTString();

         const nobjects = buf.ntou4();
         // create objects
         for (let n = 0; n < nobjects; ++n) {
            let obj = { _typename: "TPair" };
            obj.first = buf.ReadObjectAny();
            obj.second = buf.ReadObjectAny();
            if (obj.first) map.arr.push(obj);
         }
      };

      cs['TTreeIndex'] = function(buf, obj) {
         const ver = buf.last_read_version;
         obj._typename = "TTreeIndex";
         buf.ClassStreamer(obj, "TVirtualIndex");
         obj.fMajorName = buf.ReadTString();
         obj.fMinorName = buf.ReadTString();
         obj.fN = buf.ntoi8();
         obj.fIndexValues = buf.ReadFastArray(obj.fN, jsrio.kLong64);
         if (ver > 1) obj.fIndexValuesMinor = buf.ReadFastArray(obj.fN, jsrio.kLong64);
         obj.fIndex = buf.ReadFastArray(obj.fN, jsrio.kLong64);
      };

      cs['TRefArray'] = function(buf, obj) {
         obj._typename = "TRefArray";
         buf.ClassStreamer(obj, "TObject");
         obj.name = buf.ReadTString();
         const nobj = buf.ntoi4();
         obj.fLast = nobj - 1;
         obj.fLowerBound = buf.ntoi4();
         /*const pidf = */ buf.ntou2();
         obj.fUIDs = buf.ReadFastArray(nobj, jsrio.kUInt);
      };

      cs['TCanvas'] = function(buf, obj) {
         obj._typename = "TCanvas";
         buf.ClassStreamer(obj, "TPad");
         obj.fDISPLAY = buf.ReadTString();
         obj.fDoubleBuffer = buf.ntoi4();
         obj.fRetained = (buf.ntou1() !== 0);
         obj.fXsizeUser = buf.ntoi4();
         obj.fYsizeUser = buf.ntoi4();
         obj.fXsizeReal = buf.ntoi4();
         obj.fYsizeReal = buf.ntoi4();
         obj.fWindowTopX = buf.ntoi4();
         obj.fWindowTopY = buf.ntoi4();
         obj.fWindowWidth = buf.ntoi4();
         obj.fWindowHeight = buf.ntoi4();
         obj.fCw = buf.ntou4();
         obj.fCh = buf.ntou4();
         obj.fCatt = buf.ClassStreamer({}, "TAttCanvas");
         buf.ntou1(); // ignore b << TestBit(kMoveOpaque);
         buf.ntou1(); // ignore b << TestBit(kResizeOpaque);
         obj.fHighLightColor = buf.ntoi2();
         obj.fBatch = (buf.ntou1() !== 0);
         buf.ntou1();   // ignore b << TestBit(kShowEventStatus);
         buf.ntou1();   // ignore b << TestBit(kAutoExec);
         buf.ntou1();   // ignore b << TestBit(kMenuBar);
      };

      cs['TObjArray'] = function(buf, list) {
         if (!list._typename) list._typename = "TObjArray";
         list.$kind = "TObjArray";
         list.name = "";
         const ver = buf.last_read_version;
         if (ver > 2)
            buf.ClassStreamer(list, "TObject");
         if (ver > 1)
            list.name = buf.ReadTString();
         const nobjects = buf.ntou4();
         let i = 0;
         list.arr = new Array(nobjects);
         list.fLast = nobjects - 1;
         list.fLowerBound = buf.ntou4();
         while (i < nobjects)
            list.arr[i++] = buf.ReadObjectAny();
      };

      cs['TPolyMarker3D'] = function(buf, marker) {
         const ver = buf.last_read_version;
         buf.ClassStreamer(marker, "TObject");
         buf.ClassStreamer(marker, "TAttMarker");
         marker.fN = buf.ntoi4();
         marker.fP = buf.ReadFastArray(marker.fN * 3, jsrio.kFloat);
         marker.fOption = buf.ReadTString();
         marker.fName = (ver > 1) ? buf.ReadTString() : "TPolyMarker3D";
      };

      cs['TPolyLine3D'] = function(buf, obj) {
         buf.ClassStreamer(obj, "TObject");
         buf.ClassStreamer(obj, "TAttLine");
         obj.fN = buf.ntoi4();
         obj.fP = buf.ReadFastArray(obj.fN * 3, jsrio.kFloat);
         obj.fOption = buf.ReadTString();
      };

      cs['TStreamerInfo'] = function(buf, obj) {
         // stream an object of class TStreamerInfo from the I/O buffer
         buf.ClassStreamer(obj, "TNamed");
         obj.fCheckSum = buf.ntou4();
         obj.fClassVersion = buf.ntou4();
         obj.fElements = buf.ReadObjectAny();
      };

      cs['TStreamerElement'] = function(buf, element) {
         // stream an object of class TStreamerElement

         const ver = buf.last_read_version;
         buf.ClassStreamer(element, "TNamed");
         element.fType = buf.ntou4();
         element.fSize = buf.ntou4();
         element.fArrayLength = buf.ntou4();
         element.fArrayDim = buf.ntou4();
         element.fMaxIndex = buf.ReadFastArray((ver == 1) ? buf.ntou4() : 5, jsrio.kUInt);
         element.fTypeName = buf.ReadTString();

         if ((element.fType === jsrio.kUChar) && ((element.fTypeName == "Bool_t") || (element.fTypeName == "bool")))
            element.fType = jsrio.kBool;

         element.fXmin = element.fXmax = element.fFactor = 0;
         if (ver === 3) {
            element.fXmin = buf.ntod();
            element.fXmax = buf.ntod();
            element.fFactor = buf.ntod();
         } else if ((ver > 3) && (element.fBits & JSROOT.BIT(6))) { // kHasRange

            let p1 = element.fTitle.indexOf("[");
            if ((p1 >= 0) && (element.fType > jsrio.kOffsetP)) p1 = element.fTitle.indexOf("[", p1 + 1);
            let p2 = element.fTitle.indexOf("]", p1 + 1);

            if ((p1 >= 0) && (p2 >= p1 + 2)) {

               let arr = element.fTitle.substr(p1+1, p2 - p1 - 1).split(","), nbits = 32;
               if (!arr || arr.length < 2)
                  throw new Error(`Problem to decode range setting from streamer element title ${element.fTitle}`);

               if (arr.length === 3) nbits = parseInt(arr[2]);
               if (isNaN(nbits) || (nbits < 2) || (nbits > 32)) nbits = 32;

               function parse_range(val) {
                  if (!val) return 0;
                  if (val.indexOf("pi") < 0) return parseFloat(val);
                  val = val.trim();
                  let sign = 1.;
                  if (val[0] == "-") { sign = -1; val = val.substr(1); }
                  switch (val) {
                     case "2pi":
                     case "2*pi":
                     case "twopi": return sign * 2 * Math.PI;
                     case "pi/2": return sign * Math.PI / 2;
                     case "pi/4": return sign * Math.PI / 4;
                  }
                  return sign * Math.PI;
               }

               element.fXmin = parse_range(arr[0]);
               element.fXmax = parse_range(arr[1]);

               const bigint = (nbits < 32) ? (1 << nbits) : 0xffffffff;
               if (element.fXmin < element.fXmax) element.fFactor = bigint / (element.fXmax - element.fXmin);
               else if (nbits < 15) element.fXmin = nbits;
            }
         }
      };

      cs['TStreamerBase'] = function(buf, elem) {
         const ver = buf.last_read_version;
         buf.ClassStreamer(elem, "TStreamerElement");
         if (ver > 2) elem.fBaseVersion = buf.ntou4();
      };

      cs['TStreamerBasicPointer'] = cs['TStreamerLoop'] = function(buf, elem) {
         if (buf.last_read_version > 1) {
            buf.ClassStreamer(elem, "TStreamerElement");
            elem.fCountVersion = buf.ntou4();
            elem.fCountName = buf.ReadTString();
            elem.fCountClass = buf.ReadTString();
         }
      };

      cs['TStreamerSTL'] = function(buf, elem) {
         buf.ClassStreamer(elem, "TStreamerElement");
         elem.fSTLtype = buf.ntou4();
         elem.fCtype = buf.ntou4();

         if ((elem.fSTLtype === jsrio.kSTLmultimap) &&
            ((elem.fTypeName.indexOf("std::set") === 0) ||
               (elem.fTypeName.indexOf("set") === 0))) elem.fSTLtype = jsrio.kSTLset;

         if ((elem.fSTLtype === jsrio.kSTLset) &&
            ((elem.fTypeName.indexOf("std::multimap") === 0) ||
               (elem.fTypeName.indexOf("multimap") === 0))) elem.fSTLtype = jsrio.kSTLmultimap;
      };

      cs['TStreamerSTLstring'] = function(buf, elem) {
         if (buf.last_read_version > 0)
            buf.ClassStreamer(elem, "TStreamerSTL");
      };

      cs['TStreamerObject'] = cs['TStreamerBasicType'] = cs['TStreamerObjectAny'] =
         cs['TStreamerString'] = cs['TStreamerObjectPointer'] = function(buf, elem) {
            if (buf.last_read_version > 1)
               buf.ClassStreamer(elem, "TStreamerElement");
         }

      cs['TStreamerObjectAnyPointer'] = function(buf, elem) {
         if (buf.last_read_version > 0)
            buf.ClassStreamer(elem, "TStreamerElement");
      }

      cs['TTree'] = {
         name: '$file',
         func: function(buf, obj) { obj.$kind = "TTree"; obj.$file = buf.fFile; buf.fFile.AddReadTree(obj); }
      }

      cs['TVirtualPerfStats'] = "TObject"; // use directly TObject streamer

      cs['RooRealVar'] = function(buf, obj) {
         const v = buf.last_read_version;
         buf.ClassStreamer(obj, "RooAbsRealLValue");
         if (v == 1) { buf.ntod(); buf.ntod(); buf.ntoi4(); } // skip fitMin, fitMax, fitBins
         obj._error = buf.ntod();
         obj._asymErrLo = buf.ntod();
         obj._asymErrHi = buf.ntod();
         if (v >= 2) obj._binning = buf.ReadObjectAny();
         if (v == 3) obj._sharedProp = buf.ReadObjectAny();
         if (v >= 4) obj._sharedProp = buf.ClassStreamer({}, "RooRealVarSharedProperties");
      };

      cs['RooAbsBinning'] = function(buf, obj) {
         buf.ClassStreamer(obj, (buf.last_read_version == 1) ? "TObject" : "TNamed");
         buf.ClassStreamer(obj, "RooPrintable");
      }

      cs['RooCategory'] = function(buf, obj) {
         const v = buf.last_read_version;
         buf.ClassStreamer(obj, "RooAbsCategoryLValue");
         obj._sharedProp = (v === 1) ? buf.ReadObjectAny() : buf.ClassStreamer({}, "RooCategorySharedProperties");
      }

      cs['RooWorkspace::CodeRepo'] = function(buf /*, obj*/) {
         const sz = (buf.last_read_version == 2) ? 3 : 2;
         for (let i = 0; i < sz; ++i) {
            let cnt = buf.ntoi4() * ((i == 0) ? 4 : 3);
            while (cnt--) buf.ReadTString();
         }
      }

      cs['RooLinkedList'] = function(buf, obj) {
         const v = buf.last_read_version;
         buf.ClassStreamer(obj, "TObject");
         let size = buf.ntoi4();
         obj.arr = JSROOT.Create("TList");
         while (size--)
            obj.arr.Add(buf.ReadObjectAny());
         if (v > 1) obj._name = buf.ReadTString();
      }

      cs['TImagePalette'] = [
         {
            basename: 'TObject', base: 1, func: function(buf, obj) {
               if (!obj._typename) obj._typename = 'TImagePalette';
               buf.ClassStreamer(obj, "TObject");
            }
         },
         { name: 'fNumPoints', func: function(buf, obj) { obj.fNumPoints = buf.ntou4(); } },
         { name: 'fPoints', func: function(buf, obj) { obj.fPoints = buf.ReadFastArray(obj.fNumPoints, jsrio.kDouble); } },
         { name: 'fColorRed', func: function(buf, obj) { obj.fColorRed = buf.ReadFastArray(obj.fNumPoints, jsrio.kUShort); } },
         { name: 'fColorGreen', func: function(buf, obj) { obj.fColorGreen = buf.ReadFastArray(obj.fNumPoints, jsrio.kUShort); } },
         { name: 'fColorBlue', func: function(buf, obj) { obj.fColorBlue = buf.ReadFastArray(obj.fNumPoints, jsrio.kUShort); } },
         { name: 'fColorAlpha', func: function(buf, obj) { obj.fColorAlpha = buf.ReadFastArray(obj.fNumPoints, jsrio.kUShort); } }
      ];

      cs['TAttImage'] = [
         { name: 'fImageQuality', func: function(buf, obj) { obj.fImageQuality = buf.ntoi4(); } },
         { name: 'fImageCompression', func: function(buf, obj) { obj.fImageCompression = buf.ntou4(); } },
         { name: 'fConstRatio', func: function(buf, obj) { obj.fConstRatio = (buf.ntou1() != 0); } },
         { name: 'fPalette', func: function(buf, obj) { obj.fPalette = buf.ClassStreamer({}, "TImagePalette"); } }
      ]

      cs['TASImage'] = function(buf, obj) {
         if ((buf.last_read_version == 1) && (buf.fFile.fVersion > 0) && (buf.fFile.fVersion < 50000)) {
            return console.warn("old TASImage version - not yet supported");
         }

         buf.ClassStreamer(obj, "TNamed");

         if (buf.ntou1() != 0) {
            const size = buf.ntoi4();
            obj.fPngBuf = buf.ReadFastArray(size, jsrio.kUChar);
         } else {
            buf.ClassStreamer(obj, "TAttImage");
            obj.fWidth = buf.ntoi4();
            obj.fHeight = buf.ntoi4();
            obj.fImgBuf = buf.ReadFastArray(obj.fWidth * obj.fHeight, jsrio.kDouble);
         }
      }

      cs['TMaterial'] = function(buf, obj) {
         const v = buf.last_read_version;
         buf.ClassStreamer(obj, "TNamed");
         obj.fNumber = buf.ntoi4();
         obj.fA = buf.ntof();
         obj.fZ = buf.ntof();
         obj.fDensity = buf.ntof();
         if (v > 2) {
            buf.ClassStreamer(obj, "TAttFill");
            obj.fRadLength = buf.ntof();
            obj.fInterLength = buf.ntof();
         } else {
            obj.fRadLength = obj.fInterLength = 0;
         }
      }

      cs['TMixture'] = function(buf, obj) {
         buf.ClassStreamer(obj, "TMaterial");
         obj.fNmixt = buf.ntoi4();
         obj.fAmixt = buf.ReadFastArray(buf.ntoi4(), jsrio.kFloat);
         obj.fZmixt = buf.ReadFastArray(buf.ntoi4(), jsrio.kFloat);
         obj.fWmixt = buf.ReadFastArray(buf.ntoi4(), jsrio.kFloat);
      }

      // these are direct streamers - not follow version/checksum logic

      let ds = jsrio.DirectStreamers;

      ds['TQObject'] = ds['TGraphStruct'] = ds['TGraphNode'] = ds['TGraphEdge'] = function() {
         // do nothing
      }

      ds['TDatime'] = function(buf, obj) {
         obj.fDatime = buf.ntou4();
         //  obj.GetDate = function() {
         //  let res = new Date();
         //  res.setFullYear((this.fDatime >>> 26) + 1995);
         //  res.setMonth((this.fDatime << 6) >>> 28);
         //  res.setDate((this.fDatime << 10) >>> 27);
         //  res.setHours((this.fDatime << 15) >>> 27);
         //  res.setMinutes((this.fDatime << 20) >>> 26);
         //  res.setSeconds((this.fDatime << 26) >>> 26);
         //  res.setMilliseconds(0);
         //  return res;
         //  }
      }

      ds['TKey'] = function(buf, key) {
         key.fNbytes = buf.ntoi4();
         key.fVersion = buf.ntoi2();
         key.fObjlen = buf.ntou4();
         key.fDatime = buf.ClassStreamer({}, 'TDatime');
         key.fKeylen = buf.ntou2();
         key.fCycle = buf.ntou2();
         if (key.fVersion > 1000) {
            key.fSeekKey = buf.ntou8();
            buf.shift(8); // skip seekPdir
         } else {
            key.fSeekKey = buf.ntou4();
            buf.shift(4); // skip seekPdir
         }
         key.fClassName = buf.ReadTString();
         key.fName = buf.ReadTString();
         key.fTitle = buf.ReadTString();
      }

      ds['TDirectory'] = function(buf, dir) {
         const version = buf.ntou2();
         dir.fDatimeC = buf.ClassStreamer({}, 'TDatime');
         dir.fDatimeM = buf.ClassStreamer({}, 'TDatime');
         dir.fNbytesKeys = buf.ntou4();
         dir.fNbytesName = buf.ntou4();
         dir.fSeekDir = (version > 1000) ? buf.ntou8() : buf.ntou4();
         dir.fSeekParent = (version > 1000) ? buf.ntou8() : buf.ntou4();
         dir.fSeekKeys = (version > 1000) ? buf.ntou8() : buf.ntou4();
         // if ((version % 1000) > 2) buf.shift(18); // skip fUUID
      }

      ds['TBasket'] = function(buf, obj) {
         buf.ClassStreamer(obj, 'TKey');
         const ver = buf.ReadVersion();
         obj.fBufferSize = buf.ntoi4();
         obj.fNevBufSize = buf.ntoi4();
         obj.fNevBuf = buf.ntoi4();
         obj.fLast = buf.ntoi4();
         if (obj.fLast > obj.fBufferSize) obj.fBufferSize = obj.fLast;
         const flag = buf.ntoi1();

         if (flag === 0) return;

         if ((flag % 10) != 2) {
            if (obj.fNevBuf) {
               obj.fEntryOffset = buf.ReadFastArray(buf.ntoi4(), jsrio.kInt);
               if ((20 < flag) && (flag < 40))
                  for (let i = 0, kDisplacementMask = 0xFF000000; i < obj.fNevBuf; ++i)
                     obj.fEntryOffset[i] &= ~kDisplacementMask;
            }

            if (flag > 40)
               obj.fDisplacement = buf.ReadFastArray(buf.ntoi4(), jsrio.kInt);
         }

         if ((flag === 1) || (flag > 10)) {
            // here is reading of raw data
            const sz = (ver.val <= 1) ? buf.ntoi4() : obj.fLast;

            if (sz > obj.fKeylen) {
               // buffer includes again complete TKey data - exclude it
               let blob = buf.extract([buf.o + obj.fKeylen, sz - obj.fKeylen]);

               obj.fBufferRef = new TBuffer(blob, 0, buf.fFile, sz - obj.fKeylen);
               obj.fBufferRef.fTagOffset = obj.fKeylen;
            }

            buf.shift(sz);
         }
      }

      ds['TRef'] = function(buf, obj) {
         buf.ClassStreamer(obj, "TObject");
         if (obj.fBits & jsrio.kHasUUID)
            obj.fUUID = buf.ReadTString();
         else
            obj.fPID = buf.ntou2();
      }

      ds['TMatrixTSym<float>'] = function(buf, obj) {
         buf.ClassStreamer(obj, "TMatrixTBase<float>");
         obj.fElements = new Float32Array(obj.fNelems);
         let arr = buf.ReadFastArray((obj.fNrows * (obj.fNcols + 1)) / 2, jsrio.kFloat), cnt = 0;
         for (let i = 0; i < obj.fNrows; ++i)
            for (let j = i; j < obj.fNcols; ++j)
               obj.fElements[j * obj.fNcols + i] = obj.fElements[i * obj.fNcols + j] = arr[cnt++];
      }

      ds['TMatrixTSym<double>'] = function(buf, obj) {
         buf.ClassStreamer(obj, "TMatrixTBase<double>");
         obj.fElements = new Float64Array(obj.fNelems);
         let arr = buf.ReadFastArray((obj.fNrows * (obj.fNcols + 1)) / 2, jsrio.kDouble), cnt = 0;
         for (let i = 0; i < obj.fNrows; ++i)
            for (let j = i; j < obj.fNcols; ++j)
               obj.fElements[j * obj.fNcols + i] = obj.fElements[i * obj.fNcols + j] = arr[cnt++];
      }

   }

   jsrio.CreateStreamerElement = function(name, typename, file) {
      // return function, which could be used for element of the map

      let elem = {
         _typename: 'TStreamerElement', fName: name, fTypeName: typename,
         fType: 0, fSize: 0, fArrayLength: 0, fArrayDim: 0, fMaxIndex: [0, 0, 0, 0, 0],
         fXmin: 0, fXmax: 0, fFactor: 0
      };

      if (typeof typename === "string") {
         elem.fType = jsrio.GetTypeId(typename);
         if ((elem.fType < 0) && file && file.fBasicTypes[typename])
            elem.fType = file.fBasicTypes[typename];
      } else {
         elem.fType = typename;
         typename = elem.fTypeName = jsrio.TypeNames[elem.fType] || "int";
      }

      if (elem.fType > 0) return elem; // basic type

      // check if there are STL containers
      let stltype = jsrio.kNotSTL, pos = typename.indexOf("<");
      if ((pos > 0) && (typename.indexOf(">") > pos + 2))
         for (let stl = 1; stl < jsrio.StlNames.length; ++stl)
            if (typename.substr(0, pos) === jsrio.StlNames[stl]) {
               stltype = stl; break;
            }

      if (stltype !== jsrio.kNotSTL) {
         elem._typename = 'TStreamerSTL';
         elem.fType = jsrio.kStreamer;
         elem.fSTLtype = stltype;
         elem.fCtype = 0;
         return elem;
      }

      let isptr = false;

      if (typename.lastIndexOf("*") === typename.length - 1) {
         isptr = true;
         elem.fTypeName = typename = typename.substr(0, typename.length - 1);
      }

      const arrkind = jsrio.GetArrayKind(typename);

      if (arrkind == 0) {
         elem.fType = jsrio.kTString;
         return elem;
      }

      elem.fType = isptr ? jsrio.kAnyP : jsrio.kAny;

      return elem;
   }

   jsrio.ReadVectorElement = function(buf) {

      if (this.member_wise) {

         const n = buf.ntou4();
         let streamer = null, ver = this.stl_version;

         if (n === 0) return []; // for empty vector no need to search split streamers

         if (n > 1000000) {
            throw new Error('member-wise streaming of ' + this.conttype + " num " + n + ' member ' + this.name);
            // return [];
         }

         if ((ver.val === this.member_ver) && (ver.checksum === this.member_checksum)) {
            streamer = this.member_streamer;
         } else {
            streamer = buf.fFile.GetStreamer(this.conttype, ver);

            this.member_streamer = streamer = buf.fFile.GetSplittedStreamer(streamer);
            this.member_ver = ver.val;
            this.member_checksum = ver.checksum;
         }

         let res = new Array(n), i, k, member;

         for (i = 0; i < n; ++i)
            res[i] = { _typename: this.conttype }; // create objects
         if (!streamer) {
            console.error('Fail to create split streamer for', this.conttype, 'need to read ', n, 'objects version', ver);
         } else {
            for (k = 0; k < streamer.length; ++k) {
               member = streamer[k];
               if (member.split_func) {
                  member.split_func(buf, res, n);
               } else {
                  for (i = 0; i < n; ++i)
                     member.func(buf, res[i]);
               }
            }
         }
         return res;
      }

      const n = buf.ntou4();
      let res = new Array(n), i = 0;

      if (n > 200000) { console.error('vector streaming for of', this.conttype, n); return res; }

      if (this.arrkind > 0) { while (i < n) res[i++] = buf.ReadFastArray(buf.ntou4(), this.arrkind); }
      else if (this.arrkind === 0) { while (i < n) res[i++] = buf.ReadTString(); }
      else if (this.isptr) { while (i < n) res[i++] = buf.ReadObjectAny(); }
      else if (this.submember) { while (i < n) res[i++] = this.submember.readelem(buf); }
      else { while (i < n) res[i++] = buf.ClassStreamer({}, this.conttype); }

      return res;
   }

   jsrio.ReadMapElement = function(buf) {
      let streamer = this.streamer;

      if (this.member_wise) {
         // when member-wise streaming is used, version is written
         const ver = this.stl_version;

         if (this.si) {
            let si = buf.fFile.FindStreamerInfo(this.pairtype, ver.val, ver.checksum);

            if (this.si !== si) {

               streamer = jsrio.GetPairStreamer(si, this.pairtype, buf.fFile);
               if (!streamer || streamer.length !== 2) {
                  console.log('Fail to produce streamer for ', this.pairtype);
                  return null;
               }
            }
         }
      }

      const n = buf.ntoi4();
      let i, res = new Array(n);
      if (this.member_wise) {
         if (buf.ntoi2() == jsrio.kStreamedMemberWise)
            buf.shift(4);
         else
            buf.shift(-2); // rewind
      }

      for (i = 0; i < n; ++i) {
         res[i] = { _typename: this.pairtype };
         streamer[0].func(buf, res[i]);
         if (!this.member_wise) streamer[1].func(buf, res[i]);
      }

      // due-to member-wise streaming second element read after first is completed
      if (this.member_wise)
         for (i = 0; i < n; ++i)
            streamer[1].func(buf, res[i]);

      return res;
   }

   /**
    * @summary Open ROOT file for reading
    *
    * @desc depending from file location, different TFile sub-class will be provided
    * @param {string|File} filename - name of file to open or instance of JS object to access local files, see https://developer.mozilla.org/en-US/docs/Web/API/File
    * @returns {object} - Promise with TFile instance when file is opened
    * @example
    * JSROOT.openFile("https://root.cern/js/files/hsimple.root")
    *        .then(f => console.log(`Open file ${f.fFileName}`)); */

   JSROOT.openFile = function(filename) {

      let file;

      if (JSROOT.nodejs) {
         if (filename.indexOf("file://") == 0)
            file = new TNodejsFile(filename.substr(7));
         else if (filename.indexOf("http") !== 0)
            file = new TNodejsFile(filename);
      }

      if (!file && (typeof filename === 'object') && filename.size && filename.name)
         file = new TLocalFile(filename);

      if (!file)
         file = new TFile(filename);

      return file.Open();
   }

   jsrio.NativeArray = JSROOT.nodejs || (window && ('Float64Array' in window));

   jsrio.ProduceCustomStreamers();

   JSROOT.TBuffer = TBuffer;
   JSROOT.TDirectory = TDirectory;
   JSROOT.TFile = TFile;
   JSROOT.TLocalFile = TLocalFile;
   JSROOT.TNodejsFile = TNodejsFile;

   JSROOT.IO = jsrio;
   if (JSROOT.nodejs) module.exports = jsrio;

   return jsrio;
})

