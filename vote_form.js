// vote_form.js
import { createPoll } from "./pollData.js";

const MAX_OPTIONS = 10;

// ====== 기존 폼 엘리먼트 가져오기 ======
const form = document.getElementById("create-poll-form");
const questionInput = document.getElementById("poll-question");

// ====== 새 컨테이너 추가 ======
const optionsContainer = document.createElement("div");
optionsContainer.id = "dynamic-options-container";
questionInput.parentNode.insertBefore(optionsContainer, questionInput.nextElementSibling);

const addButton = document.createElement("button");
addButton.type = "button";
addButton.textContent = "옵션 추가";
form.insertBefore(addButton, form.querySelector('button[type="submit"]'));

// ====== 옵션 입력 관리 ======
let optionCount = 0;

function createOptionInput() {
    if (optionCount >= MAX_OPTIONS) {
        alert(`옵션은 최대 ${MAX_OPTIONS}개까지만 추가할 수 있습니다.`);
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("option-input");

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `옵션 ${optionCount + 1}`;
    input.maxLength = 20;
    input.value = "";
    wrapper.appendChild(input);

    if (optionCount > 1) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "삭제";
        delBtn.addEventListener("click", () => {
            wrapper.remove();
            optionCount--;
            updatePlaceholders();
        });
        wrapper.appendChild(delBtn);
    }
    
    optionsContainer.appendChild(wrapper);
    optionCount++;
}

function updatePlaceholders() {
    const inputs = optionsContainer.querySelectorAll("input");
    inputs.forEach((input, i) => {
        input.placeholder = `옵션 ${i + 1}`;
    });
}

// ====== 초기 2개 생성 ======
createOptionInput();
createOptionInput();

addButton.addEventListener("click", () => createOptionInput());

// ====== 기존 form 이벤트 가로채기 ======
form.onsubmit = async (e) => {
    e.preventDefault();

    const question = questionInput.value.trim();
    const options = Array.from(optionsContainer.querySelectorAll("input"))
        .map((i) => i.value.trim())
        .filter((v) => v.length > 0);

    if (!question || question.length > 50) {
        alert("질문은 1자 이상 50자 이하로 입력해주세요.");
        return;
    }

    if (options.length < 2 || options.length > MAX_OPTIONS) {
        alert(`옵션은 2개 이상 최대 ${MAX_OPTIONS}개 이하로 입력해주세요.`);
        return;
    }

    if (options.some((opt) => opt.length > 20)) {
        alert("옵션은 20자 이하로 입력해주세요.");
        return;
    }

    try {
        await createPoll(question, options);
        alert("새 투표가 생성되었습니다.");
        questionInput.value = "";
        optionsContainer.innerHTML = "";
        optionCount = 0;
        createOptionInput();
        createOptionInput();
    } catch (err) {
        console.error("투표 생성 오류:", err);
        alert("투표 생성에 실패했습니다.");
    }
};
