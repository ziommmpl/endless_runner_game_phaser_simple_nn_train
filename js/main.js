var game;
window.onload = function()
{
    isMobile=navigator.userAgent.indexOf("Mobile");

    if (isMobile==-1)
    {
        game=new Phaser.Game(640,400,Phaser.AUTO,"ph_game");
    }
    else
    {
        game=new Phaser.Game(window.innerWidth,window.innerHeight,Phaser.AUTO,"ph_game");
        console.log("Mobile");
    }

    game.state.add("StateMain",StateMain);
    game.state.start("StateMain");
}


//NN
var nn_network;
var nn_trainer;
var nn_output;
var trainingData=[];
var auto_mode = false;
var training_complete=false;


var StateMain = {
    preload: function() {
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.scale.pageAlignVertically = true;
        this.scale.pageAlignHorizontally = true;
        game.scale.setMinMax(640,400, 1920, 1080);
        game.world.setBounds(0, 0, 640,400);

        game.load.image("grass", "images/grass.png");
        game.load.spritesheet("hero", "images/heros.png", 25, 25, 10);
        game.load.image("block", "images/block.png");
        game.load.image("playAgain", "images/playAgain.png");
        game.load.image("menu", "images/menu.png");
        game.load.image("clouds", "images/clouds.png");
        game.load.image("mountains1","images/mountains1.png");
        game.load.image("mountains2","images/mountains2.png", 25,25,20);
    },
    create: function() {
        this.power = 28;
        this.points = 0;
        this.fitnessvar=0;
        this.pointsbool = 1;
        game.stage.backgroundColor = "#00ffff";

        //run game if no focus
        this.game.stage.disableVisibilityChange = true;

        //mountains
        this.mountain1=game.add.tileSprite(0,0,game.width,game.height/2,"mountains1");
        this.mountain1.y=game.height-this.mountain1.height;

        this.mountain2=game.add.tileSprite(0,0,game.width,game.height/3,"mountains2");
        this.mountain2.y=game.height-this.mountain2.height;

        this.mountain1.autoScroll(-50,0);
        this.mountain2.autoScroll(-100,0);

        //add the clouds
        this.clouds=game.add.tileSprite(0,-10,game.width*1.1,100,"clouds");
        this.clouds.autoScroll(-50,0);


        //ground
        this.ground=game.add.tileSprite(0,game.height*0.875,game.width,50,"grass");
        this.ground.autoScroll(-150,0);
        //this.ground = game.add.sprite(0, game.height * 0.875, "ground");

        //hero last number -texture
        this.hero = game.add.sprite(game.width * .2, this.ground.y - 25, "hero",3);

        //text
        text = game.add.text(0, 0, "", {font: "15px Arial", fill: "#000000", align: "left", tabs: 50 });
        text.anchor.setTo(0,0);

        //physics engine
        game.physics.startSystem(Phaser.Physics.ARCADE);
        //enable hero physics
        game.physics.enable(this.hero, Phaser.Physics.ARCADE);
        game.physics.enable(this.ground, Phaser.Physics.ARCADE);

        //set gravity
        this.hero.body.gravity.y = 600;
        this.hero.body.collideWorldBounds = true;
        this.ground.body.immovable = true;
        //rec initial pos
        this.startY = this.hero.y;

        //blocks
        this.blocks = game.add.group();
        this.makeBlocks();

        this.pause();

        // Neural Network - create perceptron
        if(!auto_mode) {
            nn_network = new synaptic.Architect.Perceptron(2, 6, 6, 1);
            nn_trainer = new synaptic.Trainer(nn_network); // Create trainer
        }
    },
    update: function() {
        game.physics.arcade.collide(this.hero, this.ground);

        game.physics.arcade.collide(this.hero, this.blocks, this.gameOver);
        this.fitnessvar++;
        //restart blocks
        var fchild = this.blocks.getChildAt(0);

        //point counter
        if(Math.sign((game.width+fchild.x-this.hero.x))!=this.pointsbool && Math.sign((game.width+fchild.x-this.hero.x)) < 0 ){
                this.points++;
        }

        this.pointsbool = Math.sign((game.width+fchild.x-this.hero.x));

        //if off the screen reset the blocks
        if (fchild.x < -game.width-50) {
            this.makeBlocks();
        }

        //log numbers
        if(auto_mode){
            text.setText("AUTO MODE"+
                " \t SCORE: " + this.points+
                " \t DIST: "+ Math.ceil((game.width+fchild.x+100),1,0)+
                //" \n FITNESS: "+this.fitnessvar+
                " \t BOX_SPEED: "+wallSpeed+
                " \t NN_OUTPUT: " + Math.round( nn_output ));
        }
        else{
            text.setText("TRAINING"+
                " \t SCORE: " + this.points+
                " \t DIST: "+ Math.ceil((game.width+fchild.x+100),1,0)+
                //" \n FITNESS: "+this.fitnessvar+
                " \t BOX_SPEED: "+wallSpeed+
                " \t OUTPUT: "+this.do_the_jump);
        }

        //menu on text
        text.inputEnabled = true;
        text.events.onInputDown.add(this.pause, this);

        //NN INPUTS
        this.box_displacement = Math.ceil((game.width+fchild.x+100),1,0);
        this.box_speed = wallSpeed;

        // Auto Jump
        if( auto_mode==true ){
            if( this.get_op_from_trainedData( [this.box_displacement , this.box_speed] )  ){
                this.doJump();
            }
        }
        // Collecting Training Set
        if( auto_mode==false){
            //NN Output train
            if(this.hero.y == this.startY) {
                this.do_the_jump = 0;}
            else{
                this.do_the_jump = 1;}
            //NN push train data
            trainingData.push({
                'input' :  [this.box_displacement , this.box_speed],
                'output':  [this.do_the_jump]  // jump now , stay on floor
            })
            //onsole.log("BULLET DISPLACEMENT, BULLET SPEED, Stay on Air?, Stay on Floor?: ", this.box_displacement + " " +this.box_speed + " "+ this.do_the_jump
            ;
        }
    },
    mouseDown: function() {
        if (auto_mode == false) {
            game.input.onDown.add(this.mouseDown, this);
            this.doJump();

        }
    },
    doJump: function () {
        if (this.hero.y != this.startY) {
            return;
        }
        this.hero.body.velocity.y = -this.power * 12;
    },
    makeBlocks: function(){
        this.blocks.removeAll();
        this.blocks.x = game.width - this.blocks.width;
        this.blocks.y = this.ground.y-50;
        wallSpeed = game.rnd.integerInRange(300,500);
        var block = game.add.sprite(0, 0, "block");
        this.blocks.add(block);
        this.blocks.forEach(function(block){
            game.physics.enable(block, Phaser.Physics.ARCADE);
            block.body.velocity.x =-wallSpeed;
        })
    },
    gameOver: function() {
        game.state.start("StateMain");
    },
    //NN Training
    train_nn: function(){
    nn_trainer.train(trainingData, {
        rate: 0.0003,
        iterations: 1000,
        shuffle: true
    })},
    //NN Get output
    get_op_from_trainedData: function(input_param){
    nn_output = nn_network.activate(input_param);
    var on_air = Math.round( nn_output*100 );
    //console.log("Forecast ","ON AIR %: "+ on_air );
    return nn_output >= 0.5;
    },
    pause: function(){
        game.paused = true;
        this.menu = game.add.sprite(game.width/2,game.height/2,"menu");
        this.menu.bringToTop();
        this.menu.anchor.set(0.5,0.5);

        this.menu.inputEnabled = true;
        this.menu.events.onInputDown.add(this.un_pause, this);
        //game.input.onDown.add(this.un_pause, self);
    },
    un_pause: function() {
        if (game.paused) {
            game.paused = false;
            if(game.input.y > 200){
                //console.log("automod");
                if(!training_complete) {
                    console.log("","Training using Data set of "+ trainingData.length +" elements" );
                    this.train_nn();
                    training_complete=true;
                }
                auto_mode = true;
                this.points = 0;
            }
            else{
                //console.log("manual mode");
                training_complete=false;
                trainingData = [];
                auto_mode = false;
                this.points = 0;
            }

            //add listener
            game.input.onDown.add(this.mouseDown, this);
            //destroy sprite
            this.menu.destroy();
        }
    },
}