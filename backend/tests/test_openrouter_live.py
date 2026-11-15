import os
import re

import pytest

from app.openrouter import chat_completion


@pytest.mark.anyio
async def test_openrouter_live_2_plus_2() -> None:
    if os.getenv("PETAL_OPENROUTER_LIVE_TEST") != "1":
        pytest.skip("Set PETAL_OPENROUTER_LIVE_TEST=1 to authorize a live request.")

    answer = await chat_completion(
        [{"role": "user", "content": "What is 2 + 2? Reply only with the number."}]
    )

    assert re.search(r"\b4\b", answer)
