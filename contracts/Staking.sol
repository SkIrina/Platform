// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IDao.sol";

contract Staking {
    IERC20 public rewardsToken;
    IERC20 public stakingToken;
    IDao public dao;
    address public daoAddr;

    uint public rewardRatePercent = 3;
    uint public lastUpdateTime;

    uint public lockedTime = 86400;
    uint public rewardTime = 604800;

    mapping(address => uint) public rewards;
    mapping(address => uint) public stakeStart;

    address public owner;

    uint private _totalSupply;
    mapping(address => uint) public balances;

    event Staked(address _account, uint256 _amount, uint256 timestamp);
    event Unstaked(address _account, uint256 _amount, uint256 timestamp);
    event Claimed(address _account, uint256 _amount, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyDAO {
        require(msg.sender == daoAddr, "Not authorised");
        _;
    }

    constructor(address _stakingToken, address _rewardsToken) {
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
        owner = msg.sender;
    }

    function setDao(address _dao) public onlyOwner {
        dao = IDao(_dao);
        daoAddr = _dao;
    }

    function setRate(uint _newRate) public onlyDAO {
        rewardRatePercent = _newRate;
    }

    function setLockedTime(uint daysNumber) public onlyDAO {
        lockedTime = daysNumber * 86400;
    }

    function _updateReward(address account) private {
        rewards[account] = balances[account] * rewardRatePercent * ((block.timestamp - lastUpdateTime) / rewardTime) / 100
            + rewards[account];
        lastUpdateTime = block.timestamp;
    }

    function stake(uint _amount) external returns (bool) {
        require(_amount > 0, "No zero stakes");
        _updateReward(msg.sender);
        _totalSupply += _amount;
        balances[msg.sender] += _amount;
        stakeStart[msg.sender] = block.timestamp;
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount, block.timestamp);
        return true;
    }

    function unstake() external returns (bool) {
        require(balances[msg.sender] > 0, "Nothing to withdraw");
        require(block.timestamp - stakeStart[msg.sender] > lockedTime, "Staking time not finished yet");
        require(dao.withdrawalTime(msg.sender) < block.timestamp, "Voting in dao now, can't unstake");
        _updateReward(msg.sender);
        uint amount = balances[msg.sender];
        _totalSupply -= amount;
        balances[msg.sender] = 0;

        stakingToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, block.timestamp);
        return true;
    }

    function claim() external returns (bool) {
        _updateReward(msg.sender);
        require(rewards[msg.sender] > 0, "Nothing to claim");
        uint reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardsToken.transfer(msg.sender, reward);
        emit Claimed(msg.sender, reward, block.timestamp);
        return true;
    }
}
