/* Illustrative fixtures. No identity, distance or availability is verified. */
const LISTINGS = [
 {id:1,title:'Canon EOS 1500D',category:'Electronics',mode:'rent',price:250,deposit:1500,distance:.4,owner:'Aarav',verified:true,student:true,reviews:12,rating:4.8,emoji:'📷',color:'#dce2d3',condition:'Excellent',description:'DSLR camera with kit lens, charger and carry bag. A little creative freedom for your next weekend.',alternative:true},
 {id:2,title:'Your next study chair',category:'Furniture',mode:'buy',price:1200,deposit:0,distance:.7,owner:'Meera',verified:true,student:false,reviews:8,rating:4.9,emoji:'🪑',color:'#f0d5ba',condition:'Good',description:'Comfortable wooden chair. Minor marks on the legs; sturdy and ready for another semester.'},
 {id:3,title:'The everyday city cycle',category:'Outdoors',mode:'rent',price:80,deposit:500,distance:1.2,owner:'Rohan',verified:true,student:true,reviews:21,rating:4.7,emoji:'🚲',color:'#dce4eb',condition:'Good',description:'Single-speed cycle with a lock. Best for short rides around campus.',alternative:false},
 {id:4,title:'A stack of good stories',category:'Books',mode:'share',price:0,deposit:0,distance:.3,owner:'Ananya',verified:true,student:true,reviews:6,rating:5,emoji:'📚',color:'#e9dfcc',condition:'Good',description:'Borrow these novels for up to seven days, then pass the joy back. No fee or deposit.'},
 {id:5,title:'Weekend acoustic guitar',category:'Music',mode:'rent',price:120,deposit:800,distance:2.1,owner:'Kabir',verified:false,student:false,reviews:0,rating:null,emoji:'🎸',color:'#ead4c7',condition:'Good',description:'Acoustic guitar with soft case. Light wear, warm sound.',alternative:true},
 {id:6,title:'Over-ear headphones',category:'Electronics',mode:'buy',price:450,deposit:0,distance:1.5,owner:'Diya',verified:true,student:true,reviews:4,rating:4.5,emoji:'🧮',color:'#d5dfda',condition:'Excellent',description:'Comfortable over-ear headphones. Ear cushions show light wear; both speakers work.'},
 {id:7,title:'Tennis, anyone?',category:'Outdoors',mode:'share',price:0,deposit:0,distance:3.2,owner:'Ishaan',verified:false,student:false,reviews:2,rating:4.5,emoji:'🏸',color:'#e5e6c7',condition:'Good',description:'A tennis racket to borrow for up to seven days. Return it after your game.'},
 {id:8,title:'Desk lamp, bright ideas',category:'Furniture',mode:'buy',price:350,deposit:0,distance:4.6,owner:'Sara',verified:true,student:false,reviews:9,rating:4.9,emoji:'💡',color:'#efdfbd',condition:'Like new',description:'Adjustable reading lamp. Bulb included. Plug in and get to work.'},
 {id:9,title:'A tent for two',category:'Outdoors',mode:'rent',price:180,deposit:1000,distance:7,owner:'Dev',verified:true,student:true,reviews:14,rating:4.8,emoji:'⛺',color:'#d6dfce',condition:'Good',description:'Two-person tent with pegs and bag. Dry and clean before return.',alternative:false}
];
LISTINGS.forEach((item,index)=>item.image='assets/'+['camera', 'chair', 'cycle', 'books', 'guitar', 'headphones', 'sports', 'lamp', 'tent'][index]+'.jpg');
// Additional illustrative demo listings; photos are representative samples.
LISTINGS.push(...[
  {
    "id": 10,
    "title": "Creator camera kit",
    "category": "Electronics",
    "mode": "rent",
    "price": 300,
    "deposit": 1800,
    "distance": 0.8,
    "owner": "Nikhil",
    "verified": true,
    "student": true,
    "reviews": 0,
    "rating": null,
    "condition": "Excellent",
    "description": "Camera, kit lens and charger for campus events. Light marks on the base; lens is clear.",
    "alternative": true,
    "image": "assets/camera.jpg",
    "area": "Library entrance",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 11,
    "title": "A chair for your reading corner",
    "category": "Furniture",
    "mode": "buy",
    "price": 950,
    "deposit": 0,
    "distance": 1.8,
    "owner": "Tara",
    "verified": true,
    "student": false,
    "reviews": 0,
    "rating": null,
    "condition": "Good",
    "description": "Comfortable chair for a reading corner. Minor surface scratches; stable legs.",
    "alternative": false,
    "image": "assets/chair.jpg",
    "area": "Student centre",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 12,
    "title": "Semester reading bundle",
    "category": "Books",
    "mode": "share",
    "price": 0,
    "deposit": 0,
    "distance": 0.6,
    "owner": "Sana",
    "verified": false,
    "student": true,
    "reviews": 0,
    "rating": null,
    "condition": "Good",
    "description": "A mixed reading bundle to borrow for up to seven days. Some pages have pencil notes.",
    "alternative": false,
    "image": "assets/books.jpg",
    "area": "North campus gate",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 13,
    "title": "Your first acoustic guitar",
    "category": "Music",
    "mode": "buy",
    "price": 2200,
    "deposit": 0,
    "distance": 2.4,
    "owner": "Arjun",
    "verified": true,
    "student": false,
    "reviews": 0,
    "rating": null,
    "condition": "Good",
    "description": "Acoustic guitar for practice sessions. Light body wear; tune before playing. Soft case included.",
    "alternative": false,
    "image": "assets/guitar.jpg",
    "area": "Library entrance",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 14,
    "title": "Headphones for a focus session",
    "category": "Electronics",
    "mode": "rent",
    "price": 60,
    "deposit": 300,
    "distance": 1.1,
    "owner": "Neha",
    "verified": true,
    "student": true,
    "reviews": 0,
    "rating": null,
    "condition": "Excellent",
    "description": "Over-ear headphones for study or editing. Clean ear pads, working cable and balanced sound.",
    "alternative": true,
    "image": "assets/headphones.jpg",
    "area": "Student centre",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 15,
    "title": "Weekend camping tent",
    "category": "Outdoors",
    "mode": "rent",
    "price": 160,
    "deposit": 800,
    "distance": 3.4,
    "owner": "Kiran",
    "verified": false,
    "student": false,
    "reviews": 0,
    "rating": null,
    "condition": "Good",
    "description": "Two-person tent with poles and carry bag. A few cosmetic marks; return clean and dry.",
    "alternative": true,
    "image": "assets/tent.jpg",
    "area": "North campus gate",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 16,
    "title": "Tennis practice racket",
    "category": "Outdoors",
    "mode": "share",
    "price": 0,
    "deposit": 0,
    "distance": 2.7,
    "owner": "Zoya",
    "verified": true,
    "student": true,
    "reviews": 0,
    "rating": null,
    "condition": "Good",
    "description": "Borrow a tennis racket for a campus game. Grip shows wear; strings are intact. Up to seven days.",
    "alternative": false,
    "image": "assets/sports.jpg",
    "area": "Library entrance",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 17,
    "title": "Late-night reading lamp",
    "category": "Furniture",
    "mode": "buy",
    "price": 280,
    "deposit": 0,
    "distance": 1.6,
    "owner": "Aditya",
    "verified": true,
    "student": false,
    "reviews": 0,
    "rating": null,
    "condition": "Like new",
    "description": "Adjustable desk lamp with working bulb. No visible cracks; ready for your study corner.",
    "alternative": false,
    "image": "assets/lamp.jpg",
    "area": "Student centre",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 18,
    "title": "Campus commuter bicycle",
    "category": "Outdoors",
    "mode": "buy",
    "price": 2800,
    "deposit": 0,
    "distance": 4.2,
    "owner": "Riya",
    "verified": false,
    "student": true,
    "reviews": 0,
    "rating": null,
    "condition": "Fair",
    "description": "A used city bicycle for short commutes. Visible paint scratches; inspect brakes and tyre pressure at pickup.",
    "alternative": false,
    "image": "assets/cycle.jpg",
    "area": "North campus gate",
    "emoji": "",
    "color": "#edece6"
  },
  {
    "id": 19,
    "title": "Fiction exchange bundle",
    "category": "Books",
    "mode": "share",
    "price": 0,
    "deposit": 0,
    "distance": 3.8,
    "owner": "Manav",
    "verified": true,
    "student": false,
    "reviews": 0,
    "rating": null,
    "condition": "Good",
    "description": "A small collection of novels to borrow for a week. Creased spines and a few dog-eared pages.",
    "alternative": false,
    "image": "assets/books.jpg",
    "area": "Library entrance",
    "emoji": "",
    "color": "#edece6"
  }
]);
function filterListings(items, filters, savedIds=[]){return items.filter(x=>(filters.mode==='all'||x.mode===filters.mode)&&(filters.category==='all'||x.category===filters.category)&&x.distance<=filters.radius&&(filters.price===''||x.price<=Number(filters.price))&&(!filters.verified||x.verified)&&(!filters.saved||savedIds.includes(x.id))&&(x.title+' '+x.category+' '+x.description).toLowerCase().includes(filters.query.trim().toLowerCase())).sort((a,b)=>filters.sort==='price'?a.price-b.price:filters.sort==='newest'?b.id-a.id:a.distance-b.distance)}
function calculateQuote(item,days,security){const fee=item.mode==='rent'?item.price*days:item.price;const deposit=item.mode==='rent'&&security!=='guarantor'?item.deposit:0;return {fee,deposit,total:fee+deposit}}
if(typeof module!=='undefined')module.exports={LISTINGS,filterListings,calculateQuote};

// Dates use [pickup, return): an item can be picked up again on its return date.
function validDate(value) {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
function dateRangeValid(start,end){return validDate(start)&&validDate(end)&&start<end}
function listingUnavailable(item){return item.status==='sold'||(item.status==='rented'&&!dateRangeValid(item.blockedFrom,item.blockedUntil))}
function rentalDateError(item,start,end,bookings=[],excludeId){
 if(listingUnavailable(item))return 'This item is currently unavailable.';
 if(item.mode==='buy')return '';
 if(!dateRangeValid(start,end))return 'Choose a return date after the pickup date.';
 if((item.availableFrom&&start<item.availableFrom)||(item.availableUntil&&end>item.availableUntil))return 'Choose dates within the owner’s availability window.';
 const overlaps=(a,b)=>dateRangeValid(a,b)&&start<b&&end>a;
 if(overlaps(item.blockedFrom,item.blockedUntil))return 'This item is already rented or on loan during those dates.';
 if(bookings.some(r=>r.itemId===item.id&&r.id!==excludeId&&r.status==='Accepted by owner'&&overlaps(r.start,r.end)))return 'Those dates overlap an accepted booking. Choose different dates.';
 return '';
}
if(typeof module!=='undefined')Object.assign(module.exports,{validDate,dateRangeValid,listingUnavailable,rentalDateError});
