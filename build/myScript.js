//so yeah, javascript, all of the following code went just into that changing text effect
//before creating this website, i felt javscript to be a simple language and thought wondered why people hated js. now i know why, i definitely know why


//so my bad naming of variables and functions starts again, (currSentence tracks the current sentence that is displayed) (sentence_array stores all the different sentences that will be displayed)
var currSentence="I";
var cursor='_';
var sentence_array=[
" am a CS Undergrad",
" love problem solving",
" am a competitive programmer",
" can make pixel art",
" am a developer",
" am learning web development",
" love building games",
" can create low poly models",
" love procedurally generated games",
" am an introvert",
" am fascinated by neural networks",
" wanna be everything at once!"
];
//adds char to currSentence
function add(char){
  currSentence+=char;
  document.getElementById("changingText").innerHTML=currSentence+cursor;
}
//subtracts char from currSentence
function subtract(length){
  currSentence=currSentence.substring(0,length-2);
  document.getElementById("changingText").innerHTML=currSentence+cursor;
}

//so, here is when I learnt what asynchronous means in JS and that there is no sleep function in js and I had to use setTimeout, so loop wasnt going to work here cause the loop would go on even when I wanted it to pause to give delay between each add and subtract function. without any delay, sentences would form and dissolve within a fraction of a second and that amazing effect wouldnt come alive

//this function adds chars to form a sentence and works recursively
var ind_i=0,ind_j=-1;
function loopADD(){
  //this if statement is executed when the changing text bugs out(yes, it bugs out a lot and had to implement this hack cause I have no idea in this world as to what causes the bug)
  if(currSentence.length>40 || currSentence[0]!='I'){
    currSentence="I";
    ind_j=-1;
    ind_i=0;
  }

  ind_j++;
  if(ind_j!=sentence_array[ind_i].length){
  setTimeout(function() {
    add(sentence_array[ind_i][ind_j])
  }, 100);
  setTimeout(function() {
    loopADD()
  }, 100);
}
}

//this function removes chars from the sentence and works recursively
function sentRemov(){
  if(currSentence.length>2){
  setTimeout(function() {
    subtract(currSentence.length)
  }, 100);
  setTimeout(function() {
    sentRemov()
  }, 100);
}
}

//this function is called infinitely and forms and dissolves sentences alternatively
var check=0;
function infRun(){
  var local = 4000;
  if(check%2==0){
    local = 4000;
    loopADD()
  }
  else
  {
    ind_j=-1;
    ind_i++;
    if(ind_i==sentence_array.length){
      ind_i=0;
    }
    local=2000;
    sentRemov();
  }
  check++;
  setTimeout(function() {
    infRun()
  }, local);
}
infRun();