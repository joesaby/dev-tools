import json

json_file = "/Users/joseseba/Desktop/bank statement builder/bank.json"
bank_categories = "/Users/joseseba/Desktop/bank statement builder/bank_categories.json"
out_file = "/Users/joseseba/Desktop/bank statement builder/bank_out.csv"

main_categories = {}
all_categories = {}
cat_id_mapping = {}
out_list = []

def find_categories(catgs, current_parent_cat_id=0):
    for cat in catgs:
        catId = cat.get("catId")
        all_categories[catId] = cat.get("catName")
        new_cats = cat.get("categories")
        catLevel = cat.get("catLevel")
        if catLevel == 0:
            current_parent_cat_id = catId
            cat_id_mapping[catId] = []
        else:
            cat_id_mapping[current_parent_cat_id].append(catId)
        if new_cats:
            find_categories(new_cats, current_parent_cat_id)

with open(bank_categories, 'r') as f:
    categories_json = json.loads(f.read())
    catgs = categories_json.get("result")
    find_categories(catgs)

def get_parent_id(catID):
    parent_id = 0
    for k, v in cat_id_mapping.items():
        if catID in v:
            parent_id = k
            break
    return parent_id

with open(json_file, 'r') as f:
    bank_json_data = json.loads(f.read())
    operations =  bank_json_data.get("result").get("operations")
    for operation in operations:
        catID = operation.get("catId")
        dt = operation.get("postedDate")
        name = operation.get("realName")
        amount = operation.get("amount")
        main_category = all_categories.get(get_parent_id(catID))
        sub_category = all_categories.get(catID)
        if amount < 0:
            out_list.append("{0},{1},{2},{3},{4} ".format(dt,name, main_category, sub_category, abs(amount)))

with open(out_file, 'w+') as f1:
    f1.write("Date, Name, Main Category, Sub Category, Amount\n")
    f1.write('\n'.join(out_list))
