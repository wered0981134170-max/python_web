import random
from idioms_data import idioms, options_pool

def generate_multiple_choice():

    idiom = random.choice(list(idioms.keys()))
    pos = random.choice(list(idioms[idiom].keys()))

    correct_char = idiom[pos]
    question = idiom[:pos] + "＿" + idiom[pos+1:]

    wrong_opts = []

    for lvl_list in idioms[idiom][pos].values():
        wrong_opts.extend(lvl_list)

    wrong_opts = list(set(wrong_opts))

    while len(wrong_opts) < 3:
        c = random.choice(options_pool)
        if c != correct_char and c not in wrong_opts:
            wrong_opts.append(c)

    wrong_opts = random.sample(wrong_opts,3)

    choices = wrong_opts + [correct_char]
    random.shuffle(choices)

    return {
        "mode":"multiple",
        "idiom":idiom,
        "question":question,
        "choices":choices,
        "correct_char":correct_char,
        "correct_index":choices.index(correct_char)+1   # 修正
    }

def new_question():
    return generate_multiple_choice()