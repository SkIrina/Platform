// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IACDMToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

contract ACDMPlatform {
    uint public lastPrice = 10 ** 13;
    uint public tokensForSale = 100000 * (10 ** 6);
    uint public roundTime;
    uint public lastStartedSale;
    uint public lastStartedTrade;
    uint public tradedValue;
    uint public currentOrderId;
    uint public feeSum;
    uint8 public firstReferrerRate = 5;
    uint8 public secondReferrerRate = 3;
    uint8 public tradeReferrerRateX10 = 25;
    bool public isSaleRound;
    address payable public owner;
    address public daoAddr;
    address internal constant UNISWAP_ROUTER_ADDRESS = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address private poolTokenAddr = 0x079C42C7733caddf1913FA326819915945Bc0f94;
    ERC20Burnable public poolToken;
    IUniswapV2Router02 public uniswapRouter;
    IACDMToken public token;
    mapping(address => address) public referrers;

    struct Order {
        address seller;
        uint amount;
        uint price;
    }
    mapping(uint => Order) public orders;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyDao {
        require(msg.sender == daoAddr, "Not authorised");
        _;
    }

    constructor(address _tokenAddr, uint _roundTime) {
        token = IACDMToken(_tokenAddr);
        roundTime = _roundTime;
        lastStartedSale = block.timestamp;
        isSaleRound = true;
        referrers[msg.sender] = msg.sender;
        owner = payable(msg.sender);
    }

    function startSaleRound() public {
        require(block.timestamp - lastStartedTrade > roundTime, "Trade round not finished yet");
        _updatePrice();
        tokensForSale = tradedValue / lastPrice;
        token.mint(address(this), tokensForSale);
        lastStartedSale = block.timestamp;
        isSaleRound = true;
    }

    function startTradeRound() public {
        require((block.timestamp - lastStartedSale > roundTime) || (tokensForSale == 0), "Sale round not finished yet");
        token.burn(tokensForSale);
        lastStartedTrade = block.timestamp;
        tradedValue = 0;
        isSaleRound = false;
    }

    function buyACDM(uint amount) public payable {
        require(isSaleRound, "Not the sale round now");
        require(amount <= tokensForSale, "Not enough tokens for sale");
        uint cost = lastPrice * amount / (10 ** 6);
        require(cost == msg.value, "Wrong amount of ether sent");
        tokensForSale -= amount;
        token.transfer(msg.sender, amount);
        address referrer1 = referrers[msg.sender];
        if (referrer1 != address(0)) {
            payable(referrer1).transfer(cost * firstReferrerRate / 100);
            if (referrers[referrer1] != address(0)) {
                payable(referrers[referrer1]).transfer(cost * secondReferrerRate / 100);
            }
        }
    }

    function addOrder(uint amount, uint price) public returns (uint orderId) {
        require(isSaleRound == false, "Not trade round now");
        require(price > 0, "Non-zero price required");
        require(amount > 0, "Non-zero amount required");
        token.transferFrom(msg.sender, address(this), amount);
        currentOrderId++;
        Order storage o = orders[currentOrderId];
        o.seller = msg.sender;
        o.price = price;
        o.amount = amount;
        return currentOrderId;
    }

    function redeemOrder(uint orderId, uint amount) public payable {
        require(isSaleRound == false, "Not trade round now");
        require(orders[orderId].amount > 0, "Order sold or non-existent");
        require(orders[orderId].amount >= amount, "Can't buy more than ordered");
        uint cost = orders[orderId].price * amount / (10 ** 6);
        require(cost == msg.value, "Wrong amount of ether sent");

        token.transfer(msg.sender, amount);
        
        address referrer1 = referrers[msg.sender];
        if (referrer1 != address(0)) {
            payable(referrer1).transfer(cost * tradeReferrerRateX10 / 1000);
            if (referrers[referrer1] != address(0)) {
                payable(referrers[referrer1]).transfer(cost * tradeReferrerRateX10 / 1000);
            } else {
                feeSum += cost * tradeReferrerRateX10 / 1000;
            }
        } else {
            feeSum += cost * 2 * tradeReferrerRateX10 / 1000;
        }

        orders[orderId].amount -= amount;
        tradedValue += cost;
        payable(orders[orderId].seller).transfer(cost * 95 / 100);
    }

    function removeOrder(uint orderId) public {
        require(isSaleRound == false, "Not trade round now");
        require(orders[orderId].amount > 0, "Order sold or non-existent");
        require(orders[orderId].seller == msg.sender, "Only owner can remove the order");
        token.transfer(orders[orderId].seller, orders[orderId].amount);
        orders[orderId].amount = 0;
    }

    function register(address referrer) public {
        require(referrers[referrer] != address(0), "Your referrer is not registered");
        require(referrers[msg.sender] == address(0), "You have already registered");
        referrers[msg.sender] = referrer;
    }
    
    function setDao(address _dao) public onlyOwner {
        daoAddr = _dao;
    }

    function setFirstReferrerRate(uint8 _rate) public onlyDao {
        require(_rate < 100, "Invalid rate");
        firstReferrerRate = _rate;
    }

    function setSecondReferrerRate(uint8 _rate) public onlyDao {
        require(_rate < 100, "Invalid rate");
        secondReferrerRate = _rate;
    }

    function setTradeReferrerRateX10(uint8 _rate) public onlyDao {
        require(_rate < 1000, "Invalid rate");
        tradeReferrerRateX10 = _rate;
    }

    function sendFeeSumToOwner() public onlyDao {
        owner.transfer(feeSum);
        feeSum = 0;
    }

    function buyWithFeeSumAndBurn() public onlyDao {
        uniswapRouter = IUniswapV2Router02(UNISWAP_ROUTER_ADDRESS);
        poolToken = ERC20Burnable(poolTokenAddr);
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = poolTokenAddr;
        uint[] memory amounts = uniswapRouter.swapExactETHForTokens{value:feeSum}(0, path, address(this), block.timestamp + 10000);
        poolToken.burn(amounts[1]);
    }

    function _updatePrice() private {
        lastPrice += lastPrice / 100 * 3 + 4 * 10 ** 12;
    }
}