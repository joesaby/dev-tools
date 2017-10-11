# !/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os

__author__ = "joesaby@gmail.com"

"""
Tool to assist creation of a static website based using [mkdocs](http://www.mkdocs.org/) 

Utility to traverse through directories under a local 
`./docs` folder & prepare a new yml file that is suitable
for mkdocs to be built a static website
"""
START_TEXT = "site_name: Centos Developement \n" \
             "theme: material\n" \
             "use_directory_urls : false\n" \
             "pages:\n" \
             "- Home : 'index.md'\n"

root_dir = "./docs"

def create_mkdocs_yml(arg):
    """
    Write into mkdocs.yml
    """
    # dump to a file
    soc_file = open("mkdocs.yml", "w")
    soc_file.write(START_TEXT)
    prepare_append_text(root_dir, soc_file)
    soc_file.close()


def prepare_append_text(current_root_dir, soc_file):
    """
    Prepares the remaining part of the yml file
    by traversing through directory & retrieving
    files
    """
    master_list = {}
    for folder, subs, files in os.walk(root_dir):
        if folder != root_dir:
            folders = get_my_parent_folders(folder, subs, files)
            spaces = get_spaces(folders)
            current_folder = folders[len(folders) - 1]
            if current_folder != "pictures":
                soc_file.write("{}- '{}':\n".format(spaces, remove_underscore(current_folder)))

            for file in files:
                if file.endswith(".md"):
                    soc_file.write("  {}- '{}' : '{}/{}'\n".format(spaces, rename_file_to_title(file),
                                                                   convert_folder_list(folders), file))
        else:
            print "Current parent is root"
    print master_list


def get_spaces(folders):
    """
    Calcluate number of spaces for file indenting
    based on the number of folders
    """
    spaces = ""
    len_folders = len(folders)
    if len_folders > 1:
        # Folder space should always be (2*n)-2
        spaces = " " * ((2 * len_folders) -2 )
    return spaces



def rename_file_to_title(filename):
    """
    Rename the file name. Remove the file extension,
    remove underscore
    """
    return remove_underscore(filename.split(".md")[0])

def remove_underscore(name):
    """
    Remove underscore from the name thats passed in
    """
    return name.replace("_", " ")


def convert_folder_list(folder_list):
    """
    Convert folder list to a directory
    structure excluding ./docs
    """
    folder_string = ""
    for folder in folder_list:
        if folder_string == "":
            folder_string = "{}".format(folder)
        else:
            folder_string = "{}/{}".format(folder_string, folder)
    return folder_string


def get_my_parent_folders(folder, subs, files):
    """
    Get a list of parent folders from the path structure
    """
    temp = folder.split(root_dir)[1].split("/")
    # List comprehension: Create a list of strings
    # thats is not an empty string
    directories = [x for x in temp if x != ""]
    return directories


if __name__ == "__main__":
    create_mkdocs_yml(sys.argv[1:])
