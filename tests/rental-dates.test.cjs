const {test}=require('node:test');
const assert=require('node:assert/strict');
const {dateRangeValid,rentalDateError}=require('../dist/data.js');
const item={id:101,mode:'rent',status:'rented',availableFrom:'2030-01-01',availableUntil:'2030-02-01',blockedFrom:'2030-01-10',blockedUntil:'2030-01-15'};
test('reject malformed, impossible and reversed dates',()=>{
 for(const pair of [['2030-02-30','2030-03-04'],['x','y'],['2030-01-02','2030-01-01'],['2030-01-01','2030-01-01']])assert.equal(dateRangeValid(...pair),false);
});
test('enforce availability and block all overlap shapes',()=>{
 for(const pair of [['2029-12-31','2030-01-02'],['2030-01-30','2030-02-02'],['2030-01-09','2030-01-11'],['2030-01-11','2030-01-14'],['2030-01-14','2030-01-16'],['2030-01-09','2030-01-16']])assert.ok(rentalDateError(item,...pair));
});
test('allow adjacent bookings on return date',()=>{
 assert.equal(rentalDateError(item,'2030-01-01','2030-01-10'),'');assert.equal(rentalDateError(item,'2030-01-15','2030-02-01'),'');
});
test('accepted requests block dates but pending/cancelled do not',()=>{
 const booking={id:'r',itemId:101,start:'2030-01-20',end:'2030-01-25',status:'Accepted by owner'};
 assert.ok(rentalDateError(item,'2030-01-21','2030-01-24',[booking]));
 for(const status of ['Cancelled','Pending owner acceptance'])assert.equal(rentalDateError(item,'2030-01-21','2030-01-24',[{...booking,status}]),'');
 assert.equal(rentalDateError(item,'2030-01-21','2030-01-24',[booking],'r'),'');
});
