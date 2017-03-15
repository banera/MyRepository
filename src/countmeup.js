$(document).ready(function() {           
    
    //Defines the main models
    
    //Model for total number of votes
    function Total() {
        var self = this;
        
        //Observable number for total amount of votes
        self.Amount = ko.observable(total_votes().first().value);
        
        //Increments the total with one vote
        self.increment = function() {
           var total = self.Amount();
           self.Amount(total+1);
           var first_record = total_votes().first();
           total_votes(first_record).update({value:self.Amount()});
        }
    }
    
    //Model for single candidate
    function Candidate(name, total, real, votes) {
        var self = this;
        
        //Observable candidate name (it is used as candidate Id)
        self.Name = ko.observable(name);
        
        //Observable total votes received by the candidate
        self.TotalVotes = ko.observable(total);
        
        //Observable percentage of votes against the total       
        self.Percentage = ko.pureComputed(function() {      
            if(votes!=0) return ((total/votes)*100).toFixed(2) + " %";
            
            return "0 %";
        }, self);
        
        //Observable total votes received by the candidate which are really cunted in the final challenge
        self.RealVotes = ko.observable(real);             
        
        //Increments the total amount of votes
        self.incrementTotalVotes = function() {
            var vote = candidates({candidate:self.Name()}).get()[0].total_votes;
            candidates({candidate:self.Name()}).update({total_votes: vote + 1});
            self.TotalVotes(vote + 1);
        }
        
        //Increments the total amount of real votes
        self.incrementRealVotes = function() {
            var vote = candidates({candidate:self.Name()}).get()[0].real_votes;
            candidates({candidate:self.Name()}).update({real_votes: vote + 1});
            self.RealVotes(vote + 1);
        }
    }
    
    //Model for list of candidates
    function CandidateList() {
        var self = this;
        
        //Observable list of Candidate object
        self.Items = ko.observableArray();
        
        //Initialize Items with all the Candidates in the DB
        candidates().each(function (record,recordnumber) {
            self.Items.push(new Candidate(record["candidate"], record["total_votes"], record["real_votes"], 0));
        });
        
        //Observable Candidate currently selected by the user
        self.Selected = ko.observable();                        
        
    };
    
    //Model for list of users
    function UserList() {
        var self = this;
        
        //Return true if the user exists in the DB and already voted at least once
        self.exists = function(username) {
            if (votes({user:username}).count() > 0) {
                return true;
            }
            
            return false;
        }
        
        //Return true if the user has already voted 3 times
        self.hasUserExceedMaxVotes = function(username) {
            var user = votes({user:username}).get();
            if (self.exists(username) && user[0].value == 3) {
                return true;
            }
            
            return false;
        }
        
        //Return the number of votes submitted by the user
        self.getUserVotes = function(username) {
            if (self.exists(username)) {
                var _user = votes({user:username}).get();
                return _user[0].value;
            }
            return -1;
        }
        
        //Set the number of votes submitted by the user
        self.setUserVotes = function(username, value) {
            if (self.exists(username)) {
                votes({user:username}).update({value:value});
            }
        }
        
        //Increments by 1 vote the number of votes submitted by the user
        self.incrementVotesForUser = function(username) {
            if (self.exists(username)) {
                var _votes = self.getUserVotes(username);
                self.setUserVotes(username, _votes + 1);
            }
            else {
                // fare metodo add user e chiamare quello
                votes.insert([{user:username, value:1}]);
            }
        }
    }
    
    //Main ViewModel for the View used by the user
    function UserViewModel() {
        var self = this;
        
        //Total amount of votes submitted
        self.Total = new Total();
        
        //List of Candidates
        self.Candidates = new CandidateList();
        
        //List of Users
        self.Users = new UserList();
        
        //Current User logged in the home page
        self.CurrentUser = ko.observable('');
        
        //Return true if the current user didn't register his name
        self.IsCurrentUserNull = ko.pureComputed(function() {      
            return self.CurrentUser()=='' ? true : false;
        }, self);
        
        //Handler for Vote button. It adds a vote for the current user with the selected Candidate
        self.addVoteClickHandler = function() {
            self.addVote(self.CurrentUser(),self.Candidates.Selected());
        }
        
        //Add a new vote for the given user and with the given candidate
        self.addVote = function(username,candidate) {
            //increment total
            self.Total.increment();
            
            //if user has exceed maximum votes update the total votes only otherwise update total and real votes
            if(self.Users.hasUserExceedMaxVotes(username)) {
                candidate.incrementTotalVotes();
            }
            else {
                self.Users.incrementVotesForUser(username);
                candidate.incrementTotalVotes();
                candidate.incrementRealVotes();
            }
        }
        
        self.IsSimulatorRunning = ko.observable(false);
        
        //It runs a separate thread (Web Worker) that simulates 10 M votes
        self.runSimulator = function() {
            
            self.IsSimulatorRunning(true);
            
            //Istantiate a new Worker for submitting votes
            var worker = new Worker('src/vote_simulator.js');
            worker.addEventListener('message', function(e) {
                var candidate = self.Candidates.Items()[e.data.candidate];
                self.addVote(e.data.user, candidate);                     
            }, false);
            worker.addEventListener('stop', function(e) {
                self.IsSimulatorRunning(false);
            }, false);
            worker.postMessage('start');
        }             
    }
    
    //ViewModel for the View used by the BBC presenter
    function PresenterViewModel() {
        var self = this;
        
        //Observable list of candidates
        self.Candidates = ko.observableArray();       
        self.Winner = ko.observable('');
        self.HasCountRequested = ko.observable(false);
        
        //Retrieves the current count of votes for each Candidate
        self.countMeUp = function() {
            //reset the current status
            self.HasCountRequested(true);
            
            self.Candidates.removeAll()
            
            //get total votes
            var total = parseInt(document.getElementById("total_votes").innerText);
            
            candidates().each(function (record,recordnumber) {
                self.Candidates.push(new Candidate(record["candidate"], record["total_votes"], record["real_votes"], total));
            });
            
            self.Winner(candidates().order("real_votes desc").first().candidate);
        }
    }
    
    //Creates the viewmodels and applies the binding to the user interface controls
    var userViewModel = new UserViewModel();
    ko.applyBindings(userViewModel, document.getElementById("input_user"));
    ko.applyBindings(userViewModel, document.getElementById("ddl_candidates"));
    ko.applyBindings(userViewModel, document.getElementById("vote_btn"));
    ko.applyBindings(userViewModel, document.getElementById("simulator"));
    ko.applyBindings(userViewModel, document.getElementById("total_votes"));
    
    var presenterViewModel = new PresenterViewModel();
    ko.applyBindings(presenterViewModel, document.getElementById("count_btn"));
    ko.applyBindings(presenterViewModel, document.getElementById("result"));
    ko.applyBindings(presenterViewModel, document.getElementById("grdCand"));
    ko.applyBindings(presenterViewModel, document.getElementById("winner"));
});
