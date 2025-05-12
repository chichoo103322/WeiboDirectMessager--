/**
 * 配置项
 */
const config = {
  messageToSend: "Message", // 要发送的消息内容
  chatLoadWaitTime: 800, // 点击聊天后等待加载的时间(毫秒)
  sendIntervalTime: 800, // 发送消息的间隔时间(毫秒)
  maxRandomDelay: 700, // 最大随机延迟(毫秒)
  batchSize: 20, // 每批处理的用户数量
  batchInterval: 4000, // 批次之间的间隔时间(毫秒)
  maxRetries: 3, // 失败后最大重试次数
  targetUserCount: 1000, // 目标用户数量
  blacklistKeywords: [
    
  ] // 黑名单关键词，包含这些关键词的聊天将被跳过
};

/**
 * 日志工具，用于输出不同类型的日志信息
 */
const logger = {
  info: (message) => console.log(`%c[INFO] ${message}`, 'color: #2196F3'),
  success: (message) => console.log(`%c[SUCCESS] ${message}`, 'color: #4CAF50'),
  warning: (message) => console.log(`%c[WARNING] ${message}`, 'color: #FF9800'),
  error: (message) => console.log(`%c[ERROR] ${message}`, 'color: #F44336'),
  progress: (message) => console.log(`%c[PROGRESS] ${message}`, 'color: #9C27B0; font-weight: bold')
};

/**
 * 统计信息
 */
let stats = {
  total: 0, // 总聊天数
  blacklisted: 0, // 被黑名单过滤的数量
  processed: 0, // 已处理的用户数
  successful: 0, // 成功发送消息的数量
  failed: 0, // 发送失败的数量
  retried: 0, // 重试的次数
  batchesCompleted: 0 // 完成的批次数
};

// 已处理用户的集合，用于避免重复处理
const processedUsers = new Set();

/**
 * 延迟指定的毫秒数
 * @param {number} ms - 延迟时间(毫秒)
 * @returns {Promise} - 延迟完成后的Promise
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 添加随机延迟，模拟人工操作
 * @returns {Promise} - 延迟完成后的Promise
 */
const randomDelay = async () => {
  if (config.maxRandomDelay > 0) {
    const delay = Math.floor(Math.random() * config.maxRandomDelay);
    logger.info(`添加随机延迟: ${delay}ms`);
    await sleep(delay);
  }
};

/**
 * 获取所有聊天列表项
 * @returns {Array} - 聊天列表项数组
 */
function getAllChatListItems() {
  const listItems = document.querySelectorAll('li.sessionlist');

  if (!listItems || listItems.length === 0) {
    logger.warning("未找到聊天列表项，尝试其他可能的选择器...");
    const alternativeItems = document.querySelectorAll('li[class*="session"]');
    if (alternativeItems && alternativeItems.length > 0) {
      logger.info(`使用备用选择器找到 ${alternativeItems.length} 个聊天列表项`);
      return Array.from(alternativeItems);
    }
    logger.error("无法找到任何聊天列表项，请检查页面结构或选择器");
    return [];
  }
  logger.info(`找到 ${listItems.length} 个聊天列表项`);
  return Array.from(listItems);
}

/**
 * 检查用户是否在黑名单中
 * @param {Element} listItem - 聊天列表项元素
 * @returns {boolean} - 是否在黑名单中
 */
function isBlacklistedUser(listItem) {
  const usernameDiv = listItem.querySelector('div[class*="one-line"][class*="username"]');
  let username = "";
  if (!usernameDiv) {
    const nameDiv = listItem.querySelector('div[class*="name"]');
    if (!nameDiv) {
      logger.warning("无法获取用户名信息以判断黑名单");
      return true;
    }
    username = nameDiv.textContent.trim();
  } else {
    username = usernameDiv.textContent.trim();
  }
  return config.blacklistKeywords.some(keyword => username.includes(keyword));
}

/**
 * 从列表项中获取用户名
 * @param {Element} listItem - 聊天列表项元素
 * @returns {string} - 用户名
 */
function getUsernameFromListItem(listItem) {
  const usernameDiv = listItem.querySelector('div[class*="one-line"][class*="username"]');
  if (usernameDiv) return usernameDiv.textContent.trim();
  const nameDiv = listItem.querySelector('div[class*="name"]');
  if (nameDiv) return nameDiv.textContent.trim();
  return "未知用户";
}

/**
 * 点击聊天列表项
 * @param {Element} listItem - 聊天列表项元素
 * @returns {Promise<boolean>} - 是否点击成功
 */
async function clickChatListItem(listItem) {
  try {
    await randomDelay();
    listItem.click();
    await sleep(config.chatLoadWaitTime);
    return true;
  } catch (error) {
    logger.error(`点击聊天列表项时出错: ${error.message}`);
    return false;
  }
}

/**
 * 查找聊天输入框
 * @returns {Element|null} - 聊天输入框元素或null
 */
function findChatInputBox() {
  const selectors = [
    'div[contenteditable="true"]', 'textarea.input', 'div.textbox div[contenteditable="true"]',
    'div.text div[contenteditable="true"]', 'div[class*="input-box"] div[contenteditable="true"]',
    'div[class*="editor"] div[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
        logger.info(`通过选择器 "${selector}" 找到输入框`);
        return element;
    }
  }
  const textbox = document.querySelector('div.textbox');
  if (textbox) {
    const inputInTextbox = textbox.querySelector('div[contenteditable="true"]') || textbox.querySelector('textarea') || textbox;
    if (inputInTextbox) {
        logger.info(`通过选择器 "div.textbox" 内元素找到输入框`);
        return inputInTextbox;
    }
  }
  const possibleInputs = document.querySelectorAll('div[class*="input"], textarea[class*="input"]');
  if (possibleInputs.length > 0) {
    logger.info(`通过通用选择器 "div[class*="input"], textarea[class*="input"]" 找到输入框`);
    return possibleInputs[0];
  }
  logger.error("无法找到聊天输入框");
  return null;
}

/**
 * 在输入框中输入消息
 * @param {Element} inputBox - 输入框元素
 * @param {string} message - 要输入的消息
 * @returns {Promise<boolean>} - 是否输入成功
 */
async function typeMessage(inputBox, message) {
  try {
    if (inputBox.tagName.toLowerCase() === 'textarea') {
      inputBox.value = '';
    } else {
      inputBox.innerHTML = '';
      inputBox.innerText = '';
    }
    await sleep(200);

    // 字符输入延迟，模拟人工输入
    const charDelayBase = 30;
    const charDelayRandom = 50;

    if (inputBox.tagName.toLowerCase() === 'textarea') {
      let currentText = '';
      for (let i = 0; i < message.length; i++) {
        currentText += message[i];
        inputBox.value = currentText;
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(Math.random() * charDelayRandom + charDelayBase);
      }
      inputBox.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputBox.getAttribute('contenteditable') === 'true') {
      inputBox.innerHTML = '';
      let currentText = '';
      for (let i = 0; i < message.length; i++) {
        currentText += message[i];
        inputBox.innerText = currentText;
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(Math.random() * charDelayRandom + charDelayBase);
      }
    } else {
      let currentText = '';
      for (let i = 0; i < message.length; i++) {
        currentText += message[i];
        inputBox.innerText = currentText;
        inputBox.textContent = currentText;
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(Math.random() * charDelayRandom + charDelayBase);
      }
    }
    logger.info(`已在输入框中输入消息: "${message}"`);
    await sleep(200);
    return true;
  } catch (error) {
    logger.error(`输入消息时出错: ${error.message}`);
    return false;
  }
}

/**
 * 使用Enter键发送消息
 * @param {Element} inputBox - 输入框元素
 * @returns {Promise<boolean>} - 是否发送成功
 */
async function sendMessageWithEnter(inputBox) {
  try {
    logger.info("尝试使用Enter键发送消息");
    await randomDelay();
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
    inputBox.dispatchEvent(enterEvent);
    await sleep(250);

    inputBox.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    await sleep(250);
    return true;
  } catch (error) {
    logger.error(`使用Enter键发送消息时出错: ${error.message}`);
    return false;
  }
}

/**
 * 点击发送按钮
 * @returns {Promise<boolean>} - 是否点击成功
 */
async function clickSendButton() {
  try {
    const selectors = [
      'button.send', 'button[class*="send"]', 'div[class*="send"]',
      'span[class*="send"]', 'i[class*="send"]',
      'button:contains("发送")', 'div:contains("发送")'
    ];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element.offsetParent !== null) {
          logger.info(`尝试点击发送按钮: ${selector}`);
          element.click();
          await sleep(500);
          return true;
        }
      }
    }
    logger.warning("无法找到发送按钮");
    return false;
  } catch (error) {
    logger.error(`点击发送按钮时出错: ${error.message}`);
    return false;
  }
}

/**
 * 向用户发送消息
 * @param {Element} listItem - 聊天列表项元素
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<boolean>} - 是否发送成功
 */
async function sendMessageToUser(listItem, retryCount = 0) {
  const username = getUsernameFromListItem(listItem);
  if (processedUsers.has(username)) {
    logger.info(`用户 ${username} 已被处理过，跳过`);
    return true;
  }

  try {
    logger.info(`正在处理用户: ${username}${retryCount > 0 ? ` (重试: ${retryCount}/${config.maxRetries})` : ''}`);
    const clicked = await clickChatListItem(listItem);
    if (!clicked) {
        logger.error(`无法点击用户 ${username} 的聊天列表项`);
        return await retryIfNeeded(listItem, retryCount, "无法点击聊天列表项");
    }

    await sleep(750);

    const inputBox = findChatInputBox();
    if (!inputBox) {
        logger.error(`无法找到用户 ${username} 的聊天输入框`);
        return await retryIfNeeded(listItem, retryCount, "无法找到聊天输入框");
    }

    const typed = await typeMessage(inputBox, config.messageToSend);
    if (!typed) {
        logger.error(`无法向用户 ${username} 输入消息`);
        return await retryIfNeeded(listItem, retryCount, "无法输入消息");
    }

    await sleep(100);

    let sent = await sendMessageWithEnter(inputBox);

    if (!sent) {
      logger.warning(`使用Enter键发送消息可能未成功，尝试点击发送按钮 for ${username}`);
      sent = await clickSendButton();
    }

    if (!sent) {
        logger.error(`向用户 ${username} 发送消息失败 (Enter和按钮均失败)`);
        return await retryIfNeeded(listItem, retryCount, "发送消息失败 (Enter和按钮均失败)");
    }

    processedUsers.add(username);
    logger.success(`成功向用户 ${username} 发送消息 (或已尝试发送)`);
    return true;
  } catch (error) {
    logger.error(`向用户 ${username} 发送消息时发生错误: ${error.message}`);
    return await retryIfNeeded(listItem, retryCount, error.message);
  }
}

/**
 * 如果需要，重试发送消息
 * @param {Element} listItem - 聊天列表项元素
 * @param {number} retryCount - 当前重试次数
 * @param {string} reason - 失败原因
 * @returns {Promise<boolean>} - 是否重试成功
 */
async function retryIfNeeded(listItem, retryCount, reason = "未知原因") {
  const username = getUsernameFromListItem(listItem);
  if (retryCount < config.maxRetries) {
    stats.retried++;
    const waitTime = 1500 * (retryCount + 1);
    logger.warning(`用户 ${username} 操作失败 (${reason})。将在 ${waitTime/1000} 秒后重试 (${retryCount + 1}/${config.maxRetries})...`);
    await sleep(waitTime);
    return await sendMessageToUser(listItem, retryCount + 1);
  }
  logger.error(`向用户 ${username} 发送消息失败 (${reason})，已达到最大重试次数 ${config.maxRetries}`);
  processedUsers.add(username);
  return false;
}

/**
 * 滚动聊天列表以加载更多聊天
 * @returns {Promise<boolean>} - 是否滚动成功
 */
async function scrollChatList() {
  const possibleContainers = [
    'div.chat-list-container', 'div.session-list', 'div[class*="chat-list"]',
    'div[class*="session-list"]', 'ul.chat-list'
  ];
  let container = null;
  for (const selector of possibleContainers) {
    const element = document.querySelector(selector);
    if (element) {
      container = element;
      break;
    }
  }

  if (!container) {
    logger.warning("无法找到聊天列表容器，无法执行滚动操作");
    return false;
  }

  const originalScrollTop = container.scrollTop;
  const scrollTarget = container.scrollHeight;
  const scrollDistance = scrollTarget - originalScrollTop;

  if (scrollDistance <= 0 && originalScrollTop > 0) {
      logger.info("聊天列表已在底部或无法进一步滚动。");
      await sleep(500);
      return true;
  }

  const scrollSteps = 15;
  const scrollDelay = 75;

  logger.info("开始缓慢滚动聊天列表...");
  for (let i = 1; i <= scrollSteps; i++) {
    const nextScrollTop = originalScrollTop + (scrollDistance * i / scrollSteps);
    container.scrollTop = nextScrollTop;
    await sleep(scrollDelay);
  }
  container.scrollTop = scrollTarget;

  logger.info("已将聊天列表滚动到底部");
  await sleep(1000);
  return true;
}

/**
 * 输出当前统计信息
 */
function logStats() {
  logger.progress("当前统计信息:");
  logger.info(`- 总聊天项数 (最新获取): ${stats.total}`);
  logger.info(`- 已识别黑名单用户数: ${stats.blacklisted}`);
  logger.info(`- 尝试处理的单个用户数: ${stats.processed}`);
  logger.info(`- 成功发送/尝试消息数: ${stats.successful}`);
  logger.info(`- 操作失败数 (最终): ${stats.failed}`);
  logger.info(`- 总重试次数: ${stats.retried}`);
  logger.info(`- 完成的批次: ${stats.batchesCompleted}`);

  if (stats.processed > 0) {
    const successRate = ((stats.successful - stats.failed) / stats.processed * 100);
    logger.info(`- 估计成功率 (成功-失败)/处理: ${successRate > 0 ? successRate.toFixed(2) : 0}%`);
  }
  const progressTowardTarget = (stats.successful / config.targetUserCount * 100).toFixed(2);
  logger.progress(`- 目标完成进度: ${progressTowardTarget}% (${stats.successful}/${config.targetUserCount})`);
}

/**
 * 检查是否应该继续处理
 * @returns {boolean} - 是否应该继续
 */
function shouldContinue() {
  return stats.successful < config.targetUserCount;
}

/**
 * 处理一批用户
 * @param {Array} allChatItems - 所有聊天列表项
 * @param {number} startIndex - 开始索引
 * @returns {Promise<number>} - 处理完成后的索引
 */
async function processBatch(allChatItems, startIndex) {
  const endIndex = Math.min(startIndex + config.batchSize, allChatItems.length);
  logger.progress(`开始处理第 ${stats.batchesCompleted + 1} 批用户 (${startIndex + 1} 到 ${endIndex} / 总计 ${allChatItems.length})`);

  for (let i = startIndex; i < endIndex; i++) {
    if (!shouldContinue()) {
      logger.success(`已达到目标用户数 ${config.targetUserCount}，结束当前批次处理`);
      return i;
    }

    const listItem = allChatItems[i];
    const username = getUsernameFromListItem(listItem);
    logger.info(`[${i+1}/${allChatItems.length}] 检查聊天项: ${username}`);

    if (isBlacklistedUser(listItem)) {
      logger.info(`跳过黑名单用户: ${username}`);
      stats.blacklisted++;
      continue;
    }
    if (processedUsers.has(username) && stats.processed > 0) {
        logger.info(`用户 ${username} 在此会话中已被标记处理过，跳过`);
        continue;
    }

    stats.processed++;
    const success = await sendMessageToUser(listItem);
    if (success) {
      stats.successful++;
    } else {
      stats.failed++;
    }

    if (stats.processed > 0 && stats.processed % 5 === 0) {
      logStats();
    }

    if (i < endIndex - 1 && shouldContinue()) {
      const extraDelay = Math.floor(Math.random() * 400);
      logger.info(`等待 ${(config.sendIntervalTime + extraDelay)/1000} 秒后继续处理下一个用户...`);
      await sleep(config.sendIntervalTime + extraDelay);
    }
  }
  return endIndex;
}

/**
 * 主函数，脚本的入口点
 */
async function main() {
  logger.info("脚本已开始运行");
  logger.info(`将向符合条件的单个用户发送消息: "${config.messageToSend}"`);
  logger.info(`目标用户数量: ${config.targetUserCount}`);

  await scrollChatList();

  let allChatItems = getAllChatListItems();
  if (allChatItems.length === 0) {
    logger.error("未找到任何聊天列表项，脚本终止");
    return;
  }
  stats.total = allChatItems.length;

  let currentIndex = 0;
  while (currentIndex < allChatItems.length && shouldContinue()) {
    currentIndex = await processBatch(allChatItems, currentIndex);
    stats.batchesCompleted++;
    logStats();

    if (currentIndex >= allChatItems.length && shouldContinue()) {
        logger.info("已处理完当前列表所有用户，尝试重新滚动加载更多...");
        await scrollChatList();
        const newChatItems = getAllChatListItems();
        if (newChatItems.length > allChatItems.length && newChatItems.length > currentIndex ) {
            logger.info(`加载到新的聊天列表项，从 ${allChatItems.length} 变为 ${newChatItems.length}`);
            allChatItems = newChatItems;
            stats.total = allChatItems.length;
        } else if (newChatItems.length <= currentIndex || newChatItems.length === allChatItems.length) {
            logger.info("未加载到新的、未处理的聊天用户。");
             break;
        }
    }

    if (shouldContinue() && currentIndex < allChatItems.length) {
      logger.progress(`批次 ${stats.batchesCompleted} 已完成，休息 ${config.batchInterval/1000} 秒后继续...`);
      await sleep(config.batchInterval);
    } else if (!shouldContinue()){
        logger.info("已达到目标或处理完列表，结束。");
        break;
    }
  }

  logger.progress("脚本已执行完毕");
  logStats();

  if (stats.successful >= config.targetUserCount) {
    logger.success(`已成功向 (或尝试向) ${stats.successful} 位用户发送消息，达到目标数量 ${config.targetUserCount}`);
  } else {
    logger.warning(`已处理完所有可见用户，但仅成功发送/尝试了 ${stats.successful} 条消息，未达到目标数量 ${config.targetUserCount}`);
    logger.info("如果还有更多用户，请考虑重新加载页面或调整脚本参数后再次运行。");
  }
}

/**
 * 安全执行主函数，捕获顶层错误
 */
(async function safeExecute() {
  try {
    await main();
  } catch (error) {
    logger.error(`脚本执行过程中发生未捕获的顶层错误: ${error.message}`);
    logger.error(`错误堆栈: ${error.stack}`);
    logger.info("尽管发生错误，脚本已尽可能完成执行或已停止。");
    logStats();
  }
})();