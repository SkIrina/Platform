// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IStaking.sol";

contract Dao {
    IStaking public staking;
    uint256 private _minQuorum;
    uint256 private _debatingDuration;
    address public chairman;
    mapping(uint => Proposal) public proposals;
    mapping (address => uint) public withdrawalTime;
    uint private currentProposalId;

    struct Proposal {
        uint startedTime;
        string description;
        bool open;
        address recipient;
        uint votedYes;
        uint votedNo;
        bytes callData;
        mapping (address => bool) voters;
    }

    event ProposalFinished(uint proposalID, bool result, uint quorum, string comment);
    event Deposit(address voter, uint amount);
    event Withdraw(address voter, uint amount);
    event AddProposal(uint proposalId, bytes callData, address _recipient, string description, uint starttime);
    event Vote(address voter, uint amount, uint _proposalID, bool isSupport);

    modifier onlyChairman {
        require(msg.sender == chairman, "Not the chairman");
        _;
    }

    constructor(address chairPerson, uint256 _minimumQuorum, uint256 _debatingPeriodDuration) {
        chairman = chairPerson;
        _minQuorum = _minimumQuorum;
        _debatingDuration = _debatingPeriodDuration;
    }

    function setMinQuorum(uint newMinQuorum) public onlyChairman {
        _minQuorum = newMinQuorum;
    }

    function setDebatePeriod(uint newDebatePeriod) public onlyChairman {
        _debatingDuration = newDebatePeriod;
    }

    function setStaking(address stakingContr) public onlyChairman {
        staking = IStaking(stakingContr);
    }

    function addProposal(bytes memory callData, address _recipient, string memory description) public onlyChairman returns (uint256){
        currentProposalId++;
        Proposal storage p = proposals[currentProposalId];
        p.callData = callData;
        p.startedTime = block.timestamp;
        p.open = true;
        p.description = description;
        p.recipient = _recipient;
        emit AddProposal(currentProposalId, callData, _recipient, description, block.timestamp);
        return currentProposalId;
    }

    function vote(uint _proposalID, bool isSupport) public {
        uint votes = staking.balances(msg.sender);
        require(votes > 0, "No deposit for vote");
        require(proposals[_proposalID].startedTime > 0, "No such proposal");
        require(proposals[_proposalID].voters[msg.sender] == false, "Already voted on this proposal");
        require(proposals[_proposalID].open, "Voting period finished");
    
        if (isSupport) {
            proposals[_proposalID].votedYes += votes;
        } else {
            proposals[_proposalID].votedNo += votes;
        }
        proposals[_proposalID].voters[msg.sender] = true;
        if (withdrawalTime[msg.sender] < proposals[_proposalID].startedTime + _debatingDuration) {
            withdrawalTime[msg.sender] = proposals[_proposalID].startedTime + _debatingDuration;
        }
        emit Vote(msg.sender, votes, _proposalID, isSupport);
    }

    function finishProposal(uint _proposalID) public {
        require(proposals[_proposalID].startedTime > 0, "No such proposal");
        require(proposals[_proposalID].startedTime + _debatingDuration < block.timestamp, "Voting period not finished yet");
        require(proposals[_proposalID].open, "Voting finished already");
    
        proposals[_proposalID].open = false;
        uint quorum = proposals[_proposalID].votedNo + proposals[_proposalID].votedYes;

        bool result = quorum >= _minQuorum;
        string memory comment = "Quorum is not present";

        if (result) {
            result = proposals[_proposalID].votedNo < proposals[_proposalID].votedYes;
            comment = "Quorum voted against";
        }

        if (result) {
            result = callTest(proposals[_proposalID].recipient, proposals[_proposalID].callData);
            comment = result ? "Quorum voted pro and call data executed" : "Call to contract failed";
        }

        emit ProposalFinished(_proposalID, result, quorum, comment);
        return;
    }

    function callTest(address recipient, bytes memory signature) public returns (bool) {   
        (bool success, ) = recipient.call{value: 0} (
            signature
        );
        return success;
    }

}